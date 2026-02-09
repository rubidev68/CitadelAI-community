/**
 * Type definitions for ssh2-sftp-client
 * This module doesn't have official TypeScript definitions, so we provide our own
 */

declare module 'ssh2-sftp-client' {

  interface ConnectOptions {
    host: string;
    port?: number;
    username: string;
    password?: string; // Can be used alone or with privateKey for key+password auth
    privateKey?: string | Buffer;
    passphrase?: string; // For encrypted private keys
    readyTimeout?: number;
    retries?: number;
    retry_factor?: number;
    retry_delay?: number;
    algorithms?: {
      kex?: string[];
      cipher?: string[];
      serverHostKey?: string[];
      hmac?: string[];
      compress?: string[];
    };
  }

  interface FileInfo {
    type: 'd' | '-' | 'l'; // directory, file, or link
    name: string;
    size: number;
    modifyTime: number;
    accessTime: number;
    rights: {
      user: string;
      group: string;
      other: string;
    };
    owner: number;
    group: number;
  }

  interface ListOptions {
    pattern?: string;
    filter?: (info: FileInfo) => boolean;
  }

  class Client {
    constructor();

    connect(options: ConnectOptions): Promise<void>;
    end(): Promise<void>;
    list(remotePath?: string, patternOrOptions?: string | ListOptions): Promise<FileInfo[]>;
    exists(remotePath: string): Promise<boolean | string>;
    stat(remotePath: string): Promise<FileInfo>;
    get(remotePath: string, dst?: string | NodeJS.ReadableStream, options?: { encoding?: BufferEncoding }): Promise<Buffer | string | void>;
    put(src: string | Buffer | NodeJS.ReadableStream, remotePath: string, options?: { encoding?: BufferEncoding }): Promise<void>;
    mkdir(remotePath: string, recursive?: boolean): Promise<void>;
    rmdir(remotePath: string, recursive?: boolean): Promise<void>;
    delete(remotePath: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    chmod(remotePath: string, mode: number | string): Promise<void>;
    append(contents: string | Buffer, remotePath: string, encoding?: BufferEncoding): Promise<void>;
    createReadStream(remotePath: string, options?: { encoding?: BufferEncoding; flags?: string; mode?: number | string; autoClose?: boolean }): NodeJS.ReadableStream;
    createWriteStream(remotePath: string, options?: { encoding?: BufferEncoding; flags?: string; mode?: number | string; autoClose?: boolean }): NodeJS.WritableStream;
  }

  export = Client;
}
