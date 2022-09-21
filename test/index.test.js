"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const path_1 = require("path");
const fs = tslib_1.__importStar(require("fs"));
const core_1 = require("@babel/core");
const src_1 = tslib_1.__importDefault(require("../src"));
function trim(str) {
    return String(str).replace(/^\s+|\s+$/, '');
}
const skipOutputTests = [
    '.babelrc',
    '.DS_Store',
    'extractSourceLocation',
    'extractFromFormatMessageCall',
    'moduleSourceName',
    'inline',
    'icuSyntax',
    'removeDescriptions',
    'overrideIdFn',
    'removeDefaultMessage',
    'additionalComponentNames',
    'outputEmptyJson',
    'empty',
];
const fixturesDir = (0, path_1.join)(__dirname, 'fixtures');
const baseDir = (0, path_1.join)(__dirname, '..');
describe('emit asserts for: ', () => {
    fs.readdirSync(fixturesDir).map(caseName => {
        if (skipOutputTests.indexOf(caseName) >= 0)
            return;
        it(`output match: ${caseName}`, () => {
            const fixtureDir = (0, path_1.join)(fixturesDir, caseName);
            // Ensure messages are deleted
            const actualMessagesPath = (0, path_1.join)(fixtureDir, 'actual.json');
            if (fs.existsSync(actualMessagesPath))
                fs.unlinkSync(actualMessagesPath);
            const { code: actual, metadata } = transform((0, path_1.join)(fixtureDir, 'actual.js'), { pragma: '@react-intl' });
            expect(metadata['react-intl']).toMatchSnapshot();
            // Check code output
            expect(trim(actual)).toMatchSnapshot();
            // Check message output
            expect(require((0, path_1.join)(fixtureDir, 'actual.json'))).toMatchSnapshot();
        });
    });
});
describe('options', () => {
    it('removeDefaultMessage should remove default message', () => {
        const fixtureDir = (0, path_1.join)(fixturesDir, 'removeDefaultMessage');
        const actual = transform((0, path_1.join)(fixtureDir, 'actual.js'), {
            removeDefaultMessage: true,
        }).code;
        // Check code output
        expect(trim(actual)).toMatchSnapshot();
        // Check message output
        expect(require((0, path_1.join)(fixtureDir, 'actual.json'))).toMatchSnapshot();
    });
    it('outputEmptyJson should output empty files', function () {
        const fixtureDir = (0, path_1.join)(fixturesDir, 'outputEmptyJson');
        const actual = transform((0, path_1.join)(fixtureDir, 'actual.js'), {
            outputEmptyJson: true,
        }).code;
        // Check code output
        expect(trim(actual)).toMatchSnapshot();
        // Check message output
        expect(require((0, path_1.join)(fixtureDir, 'actual.json'))).toMatchSnapshot();
    });
    it('without outputEmptyJson should output empty files', function () {
        const fixtureDir = (0, path_1.join)(fixturesDir, 'empty');
        const actual = transform((0, path_1.join)(fixtureDir, 'actual.js'), {}).code;
        // Check code output
        expect(trim(actual)).toMatchSnapshot();
        // Check message output
        expect(fs.existsSync((0, path_1.join)(fixtureDir, 'actual.json'))).toBeFalsy();
    });
    it('correctly overrides the id when overrideIdFn is provided', () => {
        const fixtureDir = (0, path_1.join)(fixturesDir, 'overrideIdFn');
        const actual = transform((0, path_1.join)(fixtureDir, 'actual.js'), {
            overrideIdFn: (id, defaultMessage, description, filePath) => {
                const filename = (0, path_1.basename)(filePath);
                return `${filename}.${id}.${defaultMessage.length}.${typeof description}`;
            },
        }).code;
        // Check code output
        expect(trim(actual)).toMatchSnapshot();
        // Check message output
        expect(require((0, path_1.join)(fixtureDir, 'actual.json'))).toMatchSnapshot();
    });
    it('removes descriptions when plugin is applied more than once', () => {
        const fixtureDir = (0, path_1.join)(fixturesDir, 'removeDescriptions');
        expect(() => transform((0, path_1.join)(fixtureDir, 'actual.js'), {}, {
            multiplePasses: true,
        })).not.toThrow();
    });
    it('respects moduleSourceName', () => {
        const fixtureDir = (0, path_1.join)(fixturesDir, 'moduleSourceName');
        expect(() => transform((0, path_1.join)(fixtureDir, 'actual.js'), {
            moduleSourceName: 'react-i18n',
        })).not.toThrow();
        // Check message output
        expect(require((0, path_1.join)(fixtureDir, 'actual.json'))).toMatchSnapshot();
    });
    it('should be able to parse inline _ from @formatjs/macro', () => {
        const fixtureDir = (0, path_1.join)(fixturesDir, 'inline');
        expect(() => transform((0, path_1.join)(fixtureDir, 'actual.js'))).not.toThrow();
        // Check message output
        expect(require((0, path_1.join)(fixtureDir, 'actual.json'))).toMatchSnapshot();
    });
    it('respects extractSourceLocation', () => {
        const fixtureDir = (0, path_1.join)(fixturesDir, 'extractSourceLocation');
        expect(() => transform((0, path_1.join)(fixtureDir, 'actual.js'), {
            extractSourceLocation: true,
        })).not.toThrow();
        // Check message output
        const actualMessages = require((0, path_1.join)(fixtureDir, 'actual.json'));
        actualMessages.forEach((msg) => {
            msg.file = msg.file.replace(/\/|\\/g, '@@sep@@');
        });
        expect(actualMessages).toMatchSnapshot();
    });
    it('respects extractFromFormatMessageCall', () => {
        const fixtureDir = (0, path_1.join)(fixturesDir, 'extractFromFormatMessageCall');
        expect(() => transform((0, path_1.join)(fixtureDir, 'actual.js'), {
            extractFromFormatMessageCall: true,
        })).not.toThrow();
        // Check message output
        expect(require((0, path_1.join)(fixtureDir, 'actual.json'))).toMatchSnapshot();
    });
    it('respects extractFromFormatMessageCall from stateless components', () => {
        const fixtureDir = (0, path_1.join)(fixturesDir, 'extractFromFormatMessageCallStateless');
        expect(() => transform((0, path_1.join)(fixtureDir, 'actual.js'), {
            extractFromFormatMessageCall: true,
        })).not.toThrow();
        // Check message output
        expect(require((0, path_1.join)(fixtureDir, 'actual.json'))).toMatchSnapshot();
    });
    it('additionalComponentNames', () => {
        const fixtureDir = (0, path_1.join)(fixturesDir, 'additionalComponentNames');
        expect(() => transform((0, path_1.join)(fixtureDir, 'actual.js'), {
            additionalComponentNames: ['CustomMessage'],
        })).not.toThrow();
        // Check message output
        expect(require((0, path_1.join)(fixtureDir, 'actual.json'))).toMatchSnapshot();
    });
});
describe('errors', () => {
    it('Properly throws parse errors', () => {
        const fixtureDir = (0, path_1.join)(fixturesDir, 'icuSyntax');
        expect(() => transform((0, path_1.join)(fixtureDir, 'actual.js'))).toThrow(/Expected .* but "\." found/);
    });
});
const BASE_OPTIONS = {
    messagesDir: baseDir,
};
let cacheBust = 1;
function transform(filePath, options = {}, { multiplePasses = false } = {}) {
    function getPluginConfig() {
        return [
            src_1.default,
            {
                ...BASE_OPTIONS,
                ...options,
            },
            Date.now() + '' + ++cacheBust,
        ];
    }
    return (0, core_1.transformFileSync)(filePath, {
        plugins: multiplePasses
            ? [getPluginConfig(), getPluginConfig()]
            : [getPluginConfig()],
    });
}
//# sourceMappingURL=index.test.js.map