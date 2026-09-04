import { fileURLToPath, URL } from 'node:url'
import restart from 'vite-plugin-restart'

export default {
    root: 'src/',
    publicDir: '../static/',
    // Env files live at the project root, next to package.json, because that
    // is where anyone would look for them. Without this Vite would read them
    // from src/, since envDir defaults to root.
    envDir: '../',
    server:
    {
        host: true,
        open: !('SANDBOX_URL' in process.env || 'CODESANDBOX_HOST' in process.env),
    },
    build:
    {
        outDir: '../dist/',
        emptyOutDir: true,
        sourcemap: false,
        rollupOptions:
        {
            input:
            {
                main: fileURLToPath(new URL('./src/index.html', import.meta.url)),
                machine: fileURLToPath(new URL('./src/machine.html', import.meta.url)),
            },
        },
    },
    plugins:
    [
        restart({ restart: [ '../static/**', ] }),
    ],
}
