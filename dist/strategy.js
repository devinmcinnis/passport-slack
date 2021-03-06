'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

require('babel-polyfill');

var _passportOauth = require('passport-oauth2');

var _passportOauth2 = _interopRequireDefault(_passportOauth);

var _lodash = require('lodash.defaults');

var _lodash2 = _interopRequireDefault(_lodash);

var _lodash3 = require('lodash.pickby');

var _lodash4 = _interopRequireDefault(_lodash3);

var _lodash5 = require('lodash.isfunction');

var _lodash6 = _interopRequireDefault(_lodash5);

var _needle = require('needle');

var _needle2 = _interopRequireDefault(_needle);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Verify Wrapper
 *
 * Adapts the verify callback that the super class expects to the verify callback API this
 * strategy presents to the user.
 * @private
 * @param {Object} slackAuthOptions
 * @param {boolean} slackAuthOptions.passReqToCallback
 * @param {SlackStrategy~verifyCallback} slackAuthOptions.verify
 * @return {function} oauth2VerifyCallbackWithRequest
 */
function wrapVerify(slackAuthOptions) {
  return function _verify(req, accessToken, refreshToken, params, profile, verified) {
    if (!params.ok) {
      throw new Error(params.error);
    }
    var team = {
      id: params.team_id || params.team && params.team.id
    };
    var teamName = params.team_name || params.team && params.team.name;
    if (teamName) team.name = teamName;
    var scopes = new Set(params.scope.split(','));
    var extra = {};
    if (params.token_type === 'bot') {
      extra.bot = {
        id: params.bot_user_id,
        accessToken: accessToken
      };
    }
    if (params.bot) {
      extra.bot = {
        id: params.bot.bot_user_id,
        accessToken: params.bot.bot_access_token
      };
    }
    if (params.incoming_webhook) {
      extra.incomingWebhook = {
        url: params.incoming_webhook.url,
        channel: {
          name: params.incoming_webhook.channel
        },
        configurationUrl: params.incoming_webhook.configuration_url
      };
      if (params.incoming_webhook.channel_id) {
        extra.incomingWebhook.channel.id = params.incoming_webhook.channel_id;
      }
    }
    if (params.authed_user) {
      extra.authedUser = params.authed_user;
    }
    if (!slackAuthOptions.passReqToCallback) {
      slackAuthOptions.verify(accessToken, scopes, team, extra, profile, verified);
    } else {
      slackAuthOptions.verify(req, accessToken, scopes, team, extra, profile, verified);
    }
  };
}

/**
 * Slack Authentication Passport Strategy
 *
 * This strategy is suitable for implementing the 'Add to Slack' and the 'Sign in with Slack'
 * buttons in your application.
 */

var SlackStrategy = function (_OAuth2Strategy) {
  _inherits(SlackStrategy, _OAuth2Strategy);

  /**
   * Creates an instance of the SlackStrategy
   * @param {Object} options
   * @param {string} options.clientID - Your Slack App's client ID.
   * @param {string} options.clientSecret - Your Slack App's client secret.
   * @param {string} [options.callbackURL] - The default URL for your webserver to handle
   * authorization grants. You will typically use the `passport.authorize('slack')` middleware to
   * implement this route, which handles exchanging the authorization grant for an access token.
   * This can be overridden using options for `passport.authenticate()` or `passport.authorize()`.
   * @param {(string|Array<string>)} [options.scope=identity.basic] - The default scopes used for
   * authorization when the `passport.authenticate()` or `passport.authorize()` method options
   * don't specify.
   * @param {string} [options.team] - The default team for which your application will request
   * authorization. This can be overridden using options for `passporrt.authenticate()` or
   * `passport.authorize()`.
   * @param {boolean} [options.skipUserProfile=false] - Whether or not to retreive a response from
   * the `users.identity` Slack API method before invoking the verify callback.
   * @param {string} [options.tokenURL=https://slack.com/api/oauth.access]
   * @param {string} [options.authorizationURL=https://slack.com/oauth/authorize]
   * @param {string} [options.profileURL=https://slack.com/api/users.identity]
   * @param {Object} [options.customHeaders={}] - A dictionary of HTTP header names and values to
   * be used in all requests made to the Slack API from this Strategy.
   * @param {string} [options.name=slack] - The name for this strategy within passport.
   * @param {boolean} [options.passReqToCallback=false] - Set to true to give your verify callback
   * access to the incoming request.
   * @param {string} [options.scopeSeparator=,]
   * @param {string} [options.sessionKey] - The key for this strategy to use in a state store.
   * @param {Store} [options.store] - **TODO**
   * @param {boolean} [options.trustProxy]
   * @param {boolean} [options.version=v1] The version of OAuth from Slack
   * @param {SlackStrategy~verifyCallback} verify - The callback that creates the value to be stored
   * in `req.user`, `req.account`, or the customized `options.assignProperty`.
   */
  function SlackStrategy(options, verify) {
    _classCallCheck(this, SlackStrategy);

    if (!options.clientSecret) {
      throw new TypeError('SlackStrategy requires a clientSecret option');
    }
    if (!(0, _lodash6.default)(verify)) {
      throw new TypeError('SlackStrategy requires a verify callback');
    }
    var tokenURL = 'https://slack.com/api/oauth.access';
    var authorizationURL = 'https://slack.com/oauth/authorize';
    if (options.version === 'v2') {
      tokenURL = 'https://slack.com/api/oauth.v2.access';
      authorizationURL = 'https://slack.com/oauth/v2/authorize';
    }
    var mergedOptions = (0, _lodash2.default)(options || {}, {
      tokenURL: tokenURL,
      authorizationURL: authorizationURL,
      profileURL: 'https://slack.com/api/users.identity',
      passReqToCallback: false,
      skipUserProfile: false,
      scope: 'identity.basic',
      scopeSeparator: ','
    });
    var slackAuthOptions = {
      passReqToCallback: mergedOptions.passReqToCallback,
      profileURL: mergedOptions.profileURL,
      team: mergedOptions.team,
      verify: verify
    };
    // We saved the user's preference about whether to pass the request to the callback, and now to
    // simplify the implementation of wrapVerify, we tell the super class that we always want the
    // request passed to the callback.
    mergedOptions.passReqToCallback = true;

    if (!mergedOptions.skipUserProfile) {
      var scopes = mergedOptions.scope;
      if (!Array.isArray(mergedOptions.scope)) {
        scopes = [mergedOptions.scope];
      }
      if (!scopes.includes('identity.basic')) {
        throw new TypeError('SlackStrategy cannot retrieve user profiles without \'identity.basic\' scope');
      }
    }

    var _this = _possibleConstructorReturn(this, (SlackStrategy.__proto__ || Object.getPrototypeOf(SlackStrategy)).call(this, mergedOptions, wrapVerify(slackAuthOptions)));

    _this.name = mergedOptions.name || 'slack';
    _this.slackAuthOptions = slackAuthOptions;
    return _this;
  }

  /**
   * Retrieve user and team profile from Slack
   *
   * @param {string} accessToken
   * @param {Function} done
   */


  _createClass(SlackStrategy, [{
    key: 'userProfile',
    value: function userProfile(accessToken, done) {
      _needle2.default.request('get', this.slackAuthOptions.profileURL, { token: accessToken }, function (error, response, body) {
        // TODO: better errors
        if (error) {
          done(error);
        } else if (!body.ok) {
          done(new Error(body.error));
        } else {
          // eslint-disable-next-line no-param-reassign
          delete body.ok;
          done(null, body);
        }
      });
    }

    /**
     * Return extra parameters to be included in the authorization request.
     *
     * @param {Object} options
     * @return {Object}
     */

  }, {
    key: 'authorizationParams',
    value: function authorizationParams(options) {
      return (0, _lodash4.default)((0, _lodash2.default)({
        team: options.team
      }, {
        team: this.slackAuthOptions.team
      }));
    }

    /**
     * A callback your application implements to create the value stored on an authenticated request
     * as `req.user`, `req.account` (when using the `passport.authorize()` flow), or the customized
     * `options.assignProperty` (from instantiaton a {@link SlackStrategy}). You must call the `done`
     * function with either an error as the first argument, or the result value as the second
     * argument.
     *
     * @typedef {Function} SlackStrategy~verifyCallback
     * @param {http.IncomingMessage} [req] - The HTTP Request. Not present by default. Only exists
     * if the `passReqToCallback` option was set when instantiating the strategy.
     * @param {string} accessToken - The authenticated user's access token.
     * @param {Set<string>} scopes - The set of scopes for which the accessToken is authorized.
     * @param {SlackStrategy~Team} team - The Slack Team for which the user has granted your
     * application access.
     * @param {Object} extra
     * @param {?SlackStrategy~BotAuthorization} extra.bot - Details for the authorized Bot User for
     * which the user has granted your application in the Slack Team (see scope `bot`).
     * @param {?SlackStrategy~IncomingWebhookAuthorization} extra.incomingWebhook - Details for the
     * authorized Incoming Webhook for which the user has granted your application in the Slack Team
     * (see scope `incoming-webhook`).
     * @param {?SlackStrategy~Profile} profile - The User and Team profiles (if they were requested).
     * @param {function(?error: Error, ?user: Object): void} done
     */

    /**
     * @typedef {Object} SlackStrategy~Team
     * @property {string} id
     * @property {?string} name - May not always be present, see scope `identity.team`
     */

    /**
     * @typedef {Object} SlackStrategy~BotAuthorization
     * @property {string} userId - The Bot User's user ID.
     * @property {string} accessToken - The Bot User's access token.
     */

    /**
     * @typedef {Object} SlackStrategy~IncomingWebhookAuthorization
     * @property {string} url - The URL where your application is authorized by the user to post
     * messages.
     * @property {string} configurationUrl - The URL where your application can direct a user to
     * configure your Incoming WebHook.
     * @property {SlackStrategy~Channel} channel - The Channel in the Slack Team where the user has
     * authorized your application to post messages.
     */

    /**
     * @typedef {Object} SlackStrategy~Profile
     * @property {Object} user - The representation of the User returned from the `users.identity`
     * Web API method. The actual contents depend on the scopes for which your access token is
     * authorized. See scopes `identity.basic`, `identity.email`, `identity.avatar`.
     * @property {Object} team - The representation of the Team returned from the `users.identity`
     * Web API method. The actual contents depends on the scopes for which your access token is
     * authorized. See scope `identity.team`.
     */

    // TODO: channel.id, is it in there or not? when might it not be?
    /**
     * @typedef {Object} SlackStrategy~Channel
     * @property {string} id
     * @property {string} name
     */

    /**
     * @external {http.IncomingMessage} https://nodejs.org/dist/latest-v6.x/docs/api/http.html#http_class_http_incomingmessage
     */

  }]);

  return SlackStrategy;
}(_passportOauth2.default);

exports.default = SlackStrategy;