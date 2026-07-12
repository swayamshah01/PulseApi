import bcrypt from "bcrypt";
import { AppError } from "../../common/errors/AppError.js";
import { createAuthRepository } from "./auth.repository.js";
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
} from "./auth.tokens.js";

const INVALID_CREDENTIALS_MESSAGE = "The email or password is incorrect.";
const INVALID_REFRESH_MESSAGE = "The refresh token is missing, expired, or invalid.";

export function createAuthService({ database, config }) {
  const repository = createAuthRepository(database);

  async function issueSession(user, targetRepository = repository) {
    const accessToken = createAccessToken(user.id, config);
    const refresh = createRefreshToken(user.id, config);

    await targetRepository.createRefreshToken({
      userId: user.id,
      tokenHash: hashRefreshToken(refresh.token),
      expiresAt: refresh.expiresAt,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken: refresh.token,
    };
  }

  return {
    async register(input) {
      const existingUser = await repository.findUserByEmail(input.email);

      if (existingUser) {
        throw new AppError(
          409,
          "USER_ALREADY_EXISTS",
          "An account with this email already exists.",
        );
      }

      const passwordHash = await bcrypt.hash(input.password, config.BCRYPT_ROUNDS);
      let user;

      try {
        user = await repository.createUser({
          name: input.name,
          email: input.email,
          passwordHash,
        });
      } catch (error) {
        if (error.code === "P2002") {
          throw new AppError(
            409,
            "USER_ALREADY_EXISTS",
            "An account with this email already exists.",
          );
        }

        throw error;
      }

      return issueSession(user);
    },

    async login(input) {
      const user = await repository.findUserByEmail(input.email);
      const passwordMatches = user
        ? await bcrypt.compare(input.password, user.passwordHash)
        : false;

      if (!user || !passwordMatches) {
        throw new AppError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
      }

      return issueSession(user);
    },

    async refresh(rawRefreshToken) {
      if (!rawRefreshToken) {
        throw new AppError(401, "INVALID_REFRESH_TOKEN", INVALID_REFRESH_MESSAGE);
      }

      const payload = verifyRefreshToken(rawRefreshToken, config);
      const tokenHash = hashRefreshToken(rawRefreshToken);

      return repository.transaction(async (transactionRepository) => {
        const storedToken = await transactionRepository.findRefreshTokenByHash(tokenHash);
        const isUsable =
          storedToken &&
          storedToken.userId === payload.sub &&
          storedToken.revokedAt === null &&
          storedToken.expiresAt > new Date();

        if (!isUsable) {
          throw new AppError(401, "INVALID_REFRESH_TOKEN", INVALID_REFRESH_MESSAGE);
        }

        const revokeResult = await transactionRepository.revokeActiveRefreshToken(
          storedToken.id,
          new Date(),
        );

        if (revokeResult.count !== 1) {
          throw new AppError(401, "INVALID_REFRESH_TOKEN", INVALID_REFRESH_MESSAGE);
        }

        const user = await transactionRepository.findUserById(payload.sub);

        if (!user) {
          throw new AppError(401, "INVALID_REFRESH_TOKEN", INVALID_REFRESH_MESSAGE);
        }

        return issueSession(user, transactionRepository);
      });
    },

    async logout(rawRefreshToken) {
      if (rawRefreshToken) {
        await repository.revokeRefreshTokenByHash(
          hashRefreshToken(rawRefreshToken),
          new Date(),
        );
      }
    },

    async getCurrentUser(userId) {
      const user = await repository.findUserById(userId);

      if (!user) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication is required.");
      }

      return user;
    },
  };
}
