export type NamedAccounts = {
  [key in "deployer"]: string;
};

/**
 * Sender:
 *  from_user_id
 *    OR
 *  from
 *
 * Receiver
 *  to_user_id
 *    OR
 *  wallet
 */

export type RibusTransferJWT = {
  from_user_id?: number;
  from_wallet?: string;
  to_user_id?: number;
  to_wallet?: string;
  amount: number;
  // JWT standard fields
  iss: string;
  iat: number;
  exp: number;
  jti: string;
};

export type RibusSendJWT = {
  iss: string;
  user_id_from: string;
  user_id_to?: string;
  wallet?: string;
  amount: number;
  iat: number;
  exp: number;
  jti: string;
};
