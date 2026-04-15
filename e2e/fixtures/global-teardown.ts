export default async function globalTeardown(): Promise<void> {
  const srv = (globalThis as any).__E2E_SERVERS__;
  if (srv?.staticServer) {
    await new Promise<void>((r) => srv.staticServer.close(() => r()));
  }
  if (srv?.serverProc) {
    srv.serverProc.kill('SIGTERM');
  }
}
