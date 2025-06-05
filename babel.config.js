module.exports = {
    'presets': [
        ['@babel/env', {
            'loose': true,
            'modules': false,
            'exclude': [
                'transform-destructuring',
                'transform-spread',
                'transform-parameters',
                'transform-classes',
                'transform-for-of'
            ]
            // include: [
            //     ''
            // ]
        }]
    ],
    'plugins': [
    ],
    'ignore': [
        'dist/*.js'
    ],
    'comments': false
};
