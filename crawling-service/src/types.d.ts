declare module 'express' {
  interface Request {
    body: any;
    params: any;
    query: any;
  }
  interface Response {
    json(obj: any): Response;
    status(code: number): Response;
  }
  interface Application {
    use(path: string, middleware: any): Application;
    use(middleware: any): Application;
    post(path: string, handler: (req: Request, res: Response) => void): void;
    get(path: string, handler: (req: Request, res: Response) => void): void;
    listen(port: number | string, callback: () => void): void;
  }
  namespace express {
    function Router(): any;
  }
  function express(): Application;
  namespace express {
    function json(): any;
  }
  export = express;
}