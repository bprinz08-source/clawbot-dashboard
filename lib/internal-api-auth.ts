export const CLAWBOT_INTERNAL_API_TOKEN_ENV = 'CLAWBOT_INTERNAL_API_TOKEN' as const;

function getExpectedBearerToken() {
  const token = process.env[CLAWBOT_INTERNAL_API_TOKEN_ENV]?.trim();

  if (!token) {
    throw new Error(
      `${CLAWBOT_INTERNAL_API_TOKEN_ENV} is required for internal Clawbot API routes.`
    );
  }

  return token;
}

export function authorizeClawbotInternalRequest(request: Request) {
  const authorizationHeader = request.headers.get('authorization')?.trim() || '';
  const expectedToken = getExpectedBearerToken();

  if (authorizationHeader !== `Bearer ${expectedToken}`) {
    return false;
  }

  return true;
}
