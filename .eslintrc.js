module.exports = {
    "plugins": [
        "jquery"
    ],
    "env": {
        "browser": true,
        "es6": true,
        "jquery": true,
        "node": true,
    },
    "extends": "eslint:recommended",
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly",
        "chrome": "readonly",
        "browser": "readonly",
        "content": "readonly",
        "define": "readonly",
        "module": "readonly",
        "global": "readonly",
        "Decimal": "readonly",
        "JSZip": "readonly",
        "GM_xmlhttpRequest": "readonly",
        "GM_setValue": "readonly",
        "GM_getValue": "readonly",
        "GM_deleteValue": "readonly",
        "OAuth": "readonly",
        "Twitter": "readonly",
        "ZipRequest": "readonly",
        "zip_request_handler": "readonly",
        "async_set_values": "readonly",
        "async_get_values": "readonly",
        "extension_functions": "readonly",
        "BigInt": "readonly",
    },
    "parserOptions": {
        "ecmaVersion": 2018
    },
    "rules": {
        "no-unused-vars": "off",
        "no-useless-escape" : "off",
        "no-empty": "off",
        "no-constant-condition": "off",
        "no-prototype-builtins": "warn",
    }
};
