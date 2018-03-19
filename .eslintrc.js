module.exports = {
    'extends': 'airbnb-base',
    'env': {
        'jest': true,
    },
    'rules': {
        'indent': ['error', 2],
        'yoda': ['off'],
        'no-use-before-define': ['error', { 'functions': false }],
        'no-underscore-dangle': ['error', { 'allow': [ '__' ] }],
        'comma-dangle': ['error', {
            'arrays': 'always-multiline',
            'objects': 'always-multiline',
            'imports': 'always-multiline',
            'exports': 'always-multiline',
            'functions': 'never',
        }],
    }
};