// Rollup plugins
import { nodeResolve } from '@rollup/plugin-node-resolve';
// import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import babel from '@rollup/plugin-babel';
import copy from 'rollup-plugin-copy';
import mtkWorkerPlugin from './worker-plugin';

import pkg from './package.json';
const path = require('path');
const product = process.env.NODE_ENV.trim() === 'prd';

const FILEMANE = pkg.name;

const banner = `/*!\n * ${pkg.name} v${pkg.version}\n  */`;
const external = ['maptalks'];
const globals = {
    maptalks: 'maptalks'
};

const plugins = [
    json(),
    typescript({

    }),
    nodeResolve(),
    commonjs()

];

const productionPlugins = [
    ...plugins,
    terser(),
    copy({
        targets: [
            { src: 'src/*', dest: 'dist/' }
        ]
    })
];

const babelPlugin = babel({
    extensions: ['.ts', '.js'],
    babelHelpers: 'bundled'
});

function getEntry() {
    return path.join(__dirname, './src/index.ts');
}

const bundles = [
    {
        input: 'src/worker.ts',
        external: external,
        plugins: product ? plugins.concat([babelPlugin, terser({
            mangle: false
        }), mtkWorkerPlugin()]) : plugins.concat([babelPlugin, mtkWorkerPlugin()]),
        output: {
            format: 'amd',
            name: 'maptalks',
            globals,
            extend: true,
            'banner': banner,
            file: 'src/worker/worker.bundle.js'
        }
    },
    {
        input: getEntry(),
        external: external,
        plugins: plugins,
        output: {
            'format': 'umd',
            'name': 'maptalks',
            'file': `dist/${FILEMANE}.js`,
            'sourcemap': true,
            'extend': true,
            'banner': banner,
            globals
        }
    },
    {
        input: getEntry(),
        external: external,
        plugins: productionPlugins,
        output: {
            'format': 'umd',
            'name': 'maptalks',
            'file': `dist/${FILEMANE}.min.js`,
            'sourcemap': true,
            'extend': true,
            'banner': banner,
            globals
        }
    }

];

const filterBundles = product ? bundles : bundles.slice(0, 2);

export default filterBundles;
