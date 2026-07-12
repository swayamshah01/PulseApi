import { sendSuccess } from "../../common/utils/responses.js";
import {
  getRefreshCookieClearOptions,
  getRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
} from "./auth.tokens.js";

export function createAuthController({ service, config }) {
  function setRefreshCookie(response, token) {
    response.cookie(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions(config));
  }

  return {
    async register(request, response, next) {
      try {
        const session = await service.register(request.validatedBody);
        setRefreshCookie(response, session.refreshToken);
        return sendSuccess(
          response,
          { user: session.user, accessToken: session.accessToken },
          { statusCode: 201 },
        );
      } catch (error) {
        return next(error);
      }
    },

    async login(request, response, next) {
      try {
        const session = await service.login(request.validatedBody);
        setRefreshCookie(response, session.refreshToken);
        return sendSuccess(response, {
          user: session.user,
          accessToken: session.accessToken,
        });
      } catch (error) {
        return next(error);
      }
    },

    async refresh(request, response, next) {
      try {
        const session = await service.refresh(request.cookies[REFRESH_COOKIE_NAME]);
        setRefreshCookie(response, session.refreshToken);
        return sendSuccess(response, { accessToken: session.accessToken });
      } catch (error) {
        return next(error);
      }
    },

    async logout(request, response, next) {
      try {
        await service.logout(request.cookies[REFRESH_COOKIE_NAME]);
        response.clearCookie(
          REFRESH_COOKIE_NAME,
          getRefreshCookieClearOptions(config),
        );
        return sendSuccess(response, { message: "Logged out successfully." });
      } catch (error) {
        return next(error);
      }
    },

    async me(request, response, next) {
      try {
        const user = await service.getCurrentUser(request.user.id);
        return sendSuccess(response, user);
      } catch (error) {
        return next(error);
      }
    },
  };
}
