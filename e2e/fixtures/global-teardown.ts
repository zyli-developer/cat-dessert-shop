export default async function globalTeardown(): Promise<void> {
  const srv = (globalThis as any).__E2E_SERVERS__;
  if (srv?.staticServer) {
    await new Promise<void>((r) => srv.staticServer.close(() => r()));
  }
  if (srv?.serverProc) {
    srv.serverProc.kill();
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (!srv.serverProc.killed) srv.serverProc.kill('SIGKILL');
        resolve();
      }, 5_000);
      srv.serverProc.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  if (srv?.mongod) await srv.mongod.stop();
}
