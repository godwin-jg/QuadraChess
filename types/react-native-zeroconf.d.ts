declare module "react-native-zeroconf" {
  interface ZeroconfService {
    name: string;
    host: string;
    port: number;
    fullName: string;
    addresses?: string[];
  }

  class Zeroconf {
    scan(type?: string, protocol?: string, domain?: string): void;
    stop(): void;
    getServices(): string[];
    removeDeviceListeners(): void;
    addDeviceListeners(): void;
    publishService(
      type: string,
      protocol: string,
      domain: string,
      name: string,
      port: number,
      txt?: Record<string, string>
    ): void;
    unpublishService(name: string): void;

    on(event: "start", listener: () => void): void;
    on(event: "stop", listener: () => void): void;
    on(event: "found", listener: (service: ZeroconfService) => void): void;
    on(event: "resolved", listener: (service: ZeroconfService) => void): void;
    on(event: "remove", listener: (serviceName: string) => void): void;
    on(event: "update", listener: (service: ZeroconfService) => void): void;
    on(event: "error", listener: (error: any) => void): void;
  }

  export default Zeroconf;
}
