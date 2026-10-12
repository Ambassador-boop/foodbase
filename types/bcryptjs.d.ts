declare module 'bcryptjs' {
  const bcrypt: {
    hash(data: string, saltOrRounds: string | number): Promise<string>;
    compare(data: string, encrypted: string): Promise<boolean>;
    genSalt(rounds?: number): Promise<string>;
  };
  export default bcrypt;
  export const hash: typeof bcrypt.hash;
  export const compare: typeof bcrypt.compare;
  export const genSalt: typeof bcrypt.genSalt;
}
