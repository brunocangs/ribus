export type NamedAccounts = {
  [key in "deployer"]: string;
};

export type RibusTransferJWT = {
  iss: string;
  user_id: number;
  wallet: string;
  amount: number;
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
