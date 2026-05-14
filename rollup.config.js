const { nodeResolve: resolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const terser = require('rollup-plugin-terser').terser;
const pkg = require('./package.json');

const production = process.env.BUILD === 'production';
const outputFile = pkg.main;
const outputESFile = pkg.module;

const plugins = production ? [
    terser({
        output: {
            keep_quoted_props: true,
            beautify: false,
            comments: '/^!/'
        }
    })
] : [];

const banner = `/*!\n * ${pkg.name} v${pkg.version}\n * LICENSE : ${pkg.license}\n * (c) 2016-${new Date().getFullYear()} maptalks.org\n */`;

let outro = pkg.name + ' v' + pkg.version;
if (pkg.peerDependencies && pkg.peerDependencies['maptalks']) {
    outro += `, requires maptalks@${pkg.peerDependencies.maptalks}.`;
}
outro = `typeof console !== 'undefined' && console.log('${outro}');`;

// Keep maptalks as a peer dependency. UMD users should load maptalks before this bundle.
module.exports = [
    {
        input: 'src/SpiderManager.js',
        external: ['maptalks'],
        plugins: [json()].concat(plugins).concat([
            resolve({ browser: true, preferBuiltins: false }),
            commonjs({ ignoreGlobal: true })
        ]),
        output: {
            banner,
            outro,
            extend: true,
            name: 'maptalks',
            file: outputFile,
            format: 'umd',
            sourcemap: !production,
            exports: 'named',
            globals: {
                maptalks: 'maptalks'
            }
        }
    },
    {
        input: 'src/SpiderManager.js',
        plugins: [json()].concat(plugins).concat([
            resolve({ browser: true, preferBuiltins: false }),
            commonjs({ ignoreGlobal: true })
        ]),
        external: ['maptalks'],
        output: {
            banner,
            outro,
            name: 'maptalks',
            file: outputESFile,
            format: 'es',
            sourcemap: !production
        }
    }
];
