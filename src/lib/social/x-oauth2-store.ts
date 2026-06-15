import { mysqlQuery } from "@/lib/mysql";

export type XOAuth2Tokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scope: string | null;
};

export async function getXOAuth2Tokens(): Promise<XOAuth2Tokens | null> {
  try {
    const rows = await mysqlQuery<
      { access_token: string; refresh_token: string | null; expires_at: string | null; scope: string | null }[]
    >(
      `select access_token, refresh_token, cast(expires_at as char) as expires_at, scope
         from social_x_oauth where id = 1 limit 1`,
    );
    if (!rows[0]) return null;
    return {
      accessToken: rows[0].access_token,
      refreshToken: rows[0].refresh_token,
      expiresAt: rows[0].expires_at,
      scope: rows[0].scope,
    };
  } catch {
    return null;
  }
}

export async function saveXOAuth2Tokens(input: XOAuth2Tokens): Promise<void> {
  await mysqlQuery(
    `insert into social_x_oauth (id, access_token, refresh_token, expires_at, scope)
     values (1, ?, ?, ?, ?)
     on duplicate key update
       access_token = values(access_token),
       refresh_token = values(refresh_token),
       expires_at = values(expires_at),
       scope = values(scope)`,
    [input.accessToken, input.refreshToken, input.expiresAt, input.scope],
  );
}
