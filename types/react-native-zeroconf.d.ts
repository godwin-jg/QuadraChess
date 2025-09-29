declare module 'react-native-zeroconf' {
  export default class Zeroconf {
    constructor();
    on(event: string, callback: (data: any) => void): void;
    scan(type: string, protocol: string, domain: string): void;
    stop(): void;
    publishService(type: string, protocol: string, domain: string, name: string, port: number, txt: Record<string, string>): void;
    unpublishService(name: string): void;
  }
}
