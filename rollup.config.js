import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';

// Don't bundle Node.js built-ins or external dependencies
const external = [
  'http', // Node.js built-in module
];

export default [
  // Main bundle
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        exports: 'named',
        sourcemap: true,
        interop: 'auto',
      },
      {
        file: 'dist/index.esm.js',
        format: 'es',
        exports: 'named',
        sourcemap: true,
      },
    ],
    external,
    plugins: [
      nodeResolve({
        preferBuiltins: true,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false, // Let dts plugin handle this
        declarationMap: false,
        sourceMap: true,
        compilerOptions: {
          module: 'esnext',
          target: 'es2020',
        },
      }),
    ],
  },
  // Types bundle
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    external,
    plugins: [dts()],
  },
];
