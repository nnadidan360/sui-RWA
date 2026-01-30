/**
 * Casper SDK Compatibility Layer
 * Stub implementation for build compatibility
 */

export interface Deploy {
  hash: string;
  header: any;
  payment: any;
  session: any;
  approvals: any[];
}

export type DeployType = Deploy;

export class DeployUtil {
  static deployToJson(deploy: Deploy): any {
    return deploy;
  }

  static deployFromJson(json: any): Deploy {
    return json as Deploy;
  }
}

export class CLPublicKey {
  constructor(public value: string) {}
  
  static fromHex(hex: string): CLPublicKey {
    return new CLPublicKey(hex);
  }
  
  toHex(): string {
    return this.value;
  }
  
  toAccountHashStr(): string {
    return this.value;
  }
}

export class PublicKey {
  constructor(public value: string) {}
  
  static fromHex(hex: string): PublicKey {
    return new PublicKey(hex);
  }
  
  toHex(): string {
    return this.value;
  }
  
  toAccountHashStr(): string {
    return this.value;
  }
}

export class RuntimeArgs {
  private args: Map<string, any> = new Map();
  
  static new(): RuntimeArgs {
    return new RuntimeArgs();
  }
  
  insert(name: string, value: any): RuntimeArgs {
    this.args.set(name, value);
    return this;
  }
  
  toBytes(): Uint8Array {
    return new Uint8Array();
  }
}

export class CLValueBuilder {
  static string(value: string): any {
    return { value, type: 'String' };
  }
  
  static u64(value: number | string): any {
    return { value: BigInt(value), type: 'U64' };
  }
  
  static u256(value: number | string): any {
    return { value: BigInt(value), type: 'U256' };
  }
  
  static u512(value: number | string): any {
    return { value: BigInt(value), type: 'U512' };
  }
  
  static bool(value: boolean): any {
    return { value, type: 'Bool' };
  }
  
  static publicKey(key: CLPublicKey): any {
    return { value: key.value, type: 'PublicKey' };
  }
  
  static key(value: any): any {
    return { value, type: 'Key' };
  }
  
  static list(values: any[]): any {
    return { value: values, type: 'List' };
  }
  
  static option(value: any): any {
    return { value, type: 'Option' };
  }
}