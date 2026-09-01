import connectionPool from "../utils/db.mjs";

export const payoutBankRepository = {
  async findByUserId(userId) {
    const { rows } = await connectionPool.query(
      `
      SELECT
        bank_code,
        bank_name,
        account_number,
        account_name,
        book_bank_image_url
      FROM sitter_profiles
      WHERE user_id = $1
      `,
      [userId]
    );

    return rows[0] ?? null;
  },

  async updateByUserId(userId, fields) {
    const { rows } = await connectionPool.query(
      `
      UPDATE sitter_profiles
      SET bank_code = $2,
          bank_name = $3,
          account_number = $4,
          account_name = $5,
          book_bank_image_url = $6,
          updated_at = NOW()
      WHERE user_id = $1
      RETURNING bank_code, bank_name, account_number, account_name, book_bank_image_url
      `,
      [
        userId,
        fields.bankCode,
        fields.bankName,
        fields.accountNumber,
        fields.accountName,
        fields.bookBankImageUrl,
      ]
    );

    return rows[0] ?? null;
  },
};
