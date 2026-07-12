export function createAuthRepository(database) {
  return {
    findUserByEmail(email) {
      return database.user.findUnique({ where: { email } });
    },

    findUserById(id) {
      return database.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, createdAt: true },
      });
    },

    createUser(data) {
      return database.user.create({
        data,
        select: { id: true, name: true, email: true, createdAt: true },
      });
    },

    createRefreshToken(data) {
      return database.refreshToken.create({ data });
    },

    findRefreshTokenByHash(tokenHash) {
      return database.refreshToken.findUnique({ where: { tokenHash } });
    },

    revokeActiveRefreshToken(id, revokedAt) {
      return database.refreshToken.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt },
      });
    },

    revokeRefreshTokenByHash(tokenHash, revokedAt) {
      return database.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt },
      });
    },

    transaction(callback) {
      return database.$transaction((transaction) =>
        callback(createAuthRepository(transaction)),
      );
    },
  };
}
