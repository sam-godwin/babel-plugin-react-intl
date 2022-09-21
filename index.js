"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const intl_messageformat_parser_1 = require("intl-messageformat-parser");
const helper_plugin_utils_1 = require("@babel/helper-plugin-utils");
const core_1 = require("@babel/core");
const types_1 = require("@babel/types");
const schema_utils_1 = require("schema-utils");
const OPTIONS_SCHEMA = tslib_1.__importStar(require("./options.schema.json"));
const ts_transformer_1 = require("@formatjs/ts-transformer");
const DEFAULT_COMPONENT_NAMES = ["FormattedMessage"];
const EXTRACTED = Symbol("ReactIntlExtracted");
const DESCRIPTOR_PROPS = new Set([
  "id",
  "description",
  "defaultMessage",
  "partners",
  "partnerVariations",
]);
function getICUMessageValue(messagePath, { isJSXSource = false } = {}) {
  if (!messagePath) {
    return "";
  }
  const message = getMessageDescriptorValue(messagePath)
    .trim()
    .replace(/\s+/gm, " ");
  try {
    (0, intl_messageformat_parser_1.parse)(message);
  } catch (parseError) {
    if (
      isJSXSource &&
      messagePath.isLiteral() &&
      message.indexOf("\\\\") >= 0
    ) {
      throw messagePath.buildCodeFrameError(
        "[React Intl] Message failed to parse. " +
          "It looks like `\\`s were used for escaping, " +
          "this won't work with JSX string literals. " +
          "Wrap with `{}`. " +
          "See: http://facebook.github.io/react/docs/jsx-gotchas.html"
      );
    }
    throw messagePath.buildCodeFrameError(
      "[React Intl] Message failed to parse. " +
        "See: https://formatjs.io/docs/core-concepts/icu-syntax" +
        `\n${parseError}`
    );
  }
  return message;
}
function evaluatePath(path) {
  const evaluated = path.evaluate();
  if (evaluated.confident) {
    return evaluated.value;
  }
  throw path.buildCodeFrameError(
    "[React Intl] Messages must be statically evaluate-able for extraction."
  );
}
function getMessageDescriptorKey(path) {
  if (path.isIdentifier() || path.isJSXIdentifier()) {
    return path.node.name;
  }
  return evaluatePath(path);
}
function getMessageDescriptorValue(path) {
  if (!path) {
    return "";
  }
  if (path.isJSXExpressionContainer()) {
    path = path.get("expression");
  }
  // Always trim the Message Descriptor values.
  const descriptorValue = evaluatePath(path);
  return descriptorValue;
}
function createMessageDescriptor(propPaths) {
  return propPaths.reduce(
    (hash, [keyPath, valuePath]) => {
      const key = getMessageDescriptorKey(keyPath);
      if (DESCRIPTOR_PROPS.has(key)) {
        hash[key] = valuePath;
      }
      return hash;
    },
    {
      id: undefined,
      defaultMessage: undefined,
      description: undefined,
      partners: undefined,
      partnerVariations: undefined,
    }
  );
}
function evaluateMessageDescriptor(
  descriptorPath,
  isJSXSource = false,
  filename,
  idInterpolationPattern = "[contenthash:5]",
  overrideIdFn
) {
  let id = getMessageDescriptorValue(descriptorPath.id);
  const defaultMessage = getICUMessageValue(descriptorPath.defaultMessage, {
    isJSXSource,
  });
  const description = getMessageDescriptorValue(descriptorPath.description);
  const partners = getMessageDescriptorValue(descriptorPath.partners);
  const partnerVariations = getMessageDescriptorValue(
    descriptorPath.partnerVariations
  );
  if (overrideIdFn) {
    id = overrideIdFn(id, defaultMessage, description, filename);
  } else if (!id && idInterpolationPattern && defaultMessage) {
    id = (0, ts_transformer_1.interpolateName)(
      { resourcePath: filename },
      idInterpolationPattern,
      {
        content: description
          ? `${defaultMessage}#${description}`
          : defaultMessage,
      }
    );
  }
  const descriptor = {
    id,
  };
  if (description) {
    descriptor.description = description;
  }
  if (defaultMessage) {
    descriptor.defaultMessage = defaultMessage;
  }
  if (partners) {
    descriptor.partners = partners;
  }
  if (partnerVariations) {
    // @ts-expect-error
    descriptor.partnerVariations = partnerVariations;
  }
  return descriptor;
}
function storeMessage(
  { id, description, defaultMessage, partners, partnerVariations },
  path,
  { extractSourceLocation },
  filename,
  messages
) {
  if (!id && !defaultMessage) {
    throw path.buildCodeFrameError(
      "[React Intl] Message Descriptors require an `id` or `defaultMessage`."
    );
  }
  if (messages.has(id)) {
    const existing = messages.get(id);
    if (
      description !== existing.description ||
      defaultMessage !== existing.defaultMessage ||
      partners !== existing.partners ||
      partnerVariations !== existing.partnerVariations
    ) {
      throw path.buildCodeFrameError(
        `[React Intl] Duplicate message id: "${id}", ` +
          "but the `description` and/or `defaultMessage` are different."
      );
    }
  }
  let loc = {};
  if (extractSourceLocation) {
    loc = {
      file: filename,
      ...path.node.loc,
    };
  }
  messages.set(id, {
    id,
    description,
    defaultMessage,
    partners,
    partnerVariations,
    ...loc,
  });
}
function referencesImport(path, mod, importedNames) {
  if (!(path.isIdentifier() || path.isJSXIdentifier())) {
    return false;
  }
  return importedNames.some((name) => path.referencesImport(mod, name));
}
function isFormatMessageDestructuring(scope) {
  const binding = scope.getBinding("formatMessage");
  const { block } = scope;
  const declNode = binding?.path.node;
  // things like `const {formatMessage} = intl; formatMessage(...)`
  if (core_1.types.isVariableDeclarator(declNode)) {
    // things like `const {formatMessage} = useIntl(); formatMessage(...)`
    if (core_1.types.isCallExpression(declNode.init)) {
      if (core_1.types.isIdentifier(declNode.init.callee)) {
        return declNode.init.callee.name === "useIntl";
      }
    }
    return (
      core_1.types.isObjectPattern(declNode.id) &&
      declNode.id.properties.find((value) => value.key.name === "intl")
    );
  }
  // things like const fn = ({ intl: { formatMessage }}) => { formatMessage(...) }
  if (
    core_1.types.isFunctionDeclaration(block) &&
    block.params.length &&
    core_1.types.isObjectPattern(block.params[0])
  ) {
    return block.params[0].properties.find(
      (value) => value.key.name === "intl"
    );
  }
  return false;
}
function isFormatMessageCall(callee, path) {
  if (
    callee.isIdentifier() &&
    callee.node.name === "formatMessage" &&
    isFormatMessageDestructuring(path.scope)
  ) {
    return true;
  }
  if (!callee.isMemberExpression()) {
    return false;
  }
  const object = callee.get("object");
  const property = callee.get("property");
  return (
    property.isIdentifier() &&
    property.node.name === "formatMessage" &&
    !Array.isArray(object) &&
    // things like `intl.formatMessage`
    ((object.isIdentifier() && object.node.name === "intl") ||
      // things like `this.props.intl.formatMessage`
      (object.isMemberExpression() &&
        object.get("property").node.name === "intl"))
  );
}
function assertObjectExpression(path, callee) {
  if (!path || !path.isObjectExpression()) {
    throw path.buildCodeFrameError(
      `[React Intl] \`${callee.get("property").node.name}()\` must be ` +
        "called with an object expression with values " +
        "that are React Intl Message Descriptors, also " +
        "defined as object expressions."
    );
  }
  return true;
}
exports.default = (0, helper_plugin_utils_1.declare)((api, options) => {
  api.assertVersion(7);
  (0, schema_utils_1.validate)(OPTIONS_SCHEMA, options, {
    name: "babel-plugin-formatjs",
    baseDataPath: "options",
  });
  const { pragma } = options;
  /**
   * Store this in the node itself so that multiple passes work. Specifically
   * if we remove `description` in the 1st pass, 2nd pass will fail since
   * it expect `description` to be there.
   * HACK: We store this in the node instance since this persists across
   * multiple plugin runs
   */
  function tagAsExtracted(path) {
    path.node[EXTRACTED] = true;
  }
  function wasExtracted(path) {
    return !!path.node[EXTRACTED];
  }
  return {
    pre() {
      if (!this.ReactIntlMessages) {
        this.ReactIntlMessages = new Map();
        this.ReactIntlMeta = {};
      }
    },
    post(state) {
      const { ReactIntlMessages: messages, ReactIntlMeta } = this;
      const descriptors = Array.from(messages.values());
      state.metadata["react-intl"] = {
        messages: descriptors,
        meta: ReactIntlMeta,
      };
    },
    visitor: {
      Program(path) {
        const { body } = path.node;
        const { ReactIntlMeta } = this;
        if (!pragma) {
          return;
        }
        for (const { leadingComments } of body) {
          if (!leadingComments) {
            continue;
          }
          const pragmaLineNode = leadingComments.find((c) =>
            c.value.includes(pragma)
          );
          if (!pragmaLineNode) {
            continue;
          }
          pragmaLineNode.value
            .split(pragma)[1]
            .trim()
            .split(/\s+/g)
            .forEach((kv) => {
              const [k, v] = kv.split(":");
              ReactIntlMeta[k] = v;
            });
        }
      },
      JSXOpeningElement(
        path,
        {
          opts,
          file: {
            opts: { filename },
          },
        }
      ) {
        const {
          moduleSourceName = "react-intl",
          additionalComponentNames = [],
          removeDefaultMessage,
          idInterpolationPattern,
          overrideIdFn,
          ast,
        } = opts;
        if (wasExtracted(path)) {
          return;
        }
        const name = path.get("name");
        if (name.referencesImport(moduleSourceName, "FormattedPlural")) {
          if (path.node && path.node.loc)
            console.warn(
              `[React Intl] Line ${path.node.loc.start.line}: ` +
                "Default messages are not extracted from " +
                "<FormattedPlural>, use <FormattedMessage> instead."
            );
          return;
        }
        if (
          name.isJSXIdentifier() &&
          (referencesImport(name, moduleSourceName, DEFAULT_COMPONENT_NAMES) ||
            additionalComponentNames.includes(name.node.name))
        ) {
          const attributes = path
            .get("attributes")
            .filter((attr) => attr.isJSXAttribute());
          const descriptorPath = createMessageDescriptor(
            attributes.map((attr) => [attr.get("name"), attr.get("value")])
          );
          // In order for a default message to be extracted when
          // declaring a JSX element, it must be done with standard
          // `key=value` attributes. But it's completely valid to
          // write `<FormattedMessage {...descriptor} />`, because it will be
          // skipped here and extracted elsewhere. The descriptor will
          // be extracted only (storeMessage) if a `defaultMessage` prop.
          if (descriptorPath.id || descriptorPath.defaultMessage) {
            // Evaluate the Message Descriptor values in a JSX
            // context, then store it.
            const descriptor = evaluateMessageDescriptor(
              descriptorPath,
              true,
              filename,
              idInterpolationPattern,
              overrideIdFn
            );
            storeMessage(
              descriptor,
              path,
              opts,
              filename,
              this.ReactIntlMessages
            );
            let idAttr;
            let descriptionAttr;
            let defaultMessageAttr;
            for (const attr of attributes) {
              if (!attr.isJSXAttribute()) {
                continue;
              }
              switch (getMessageDescriptorKey(attr.get("name"))) {
                case "description":
                  descriptionAttr = attr;
                  break;
                case "defaultMessage":
                  defaultMessageAttr = attr;
                  break;
                case "id":
                  idAttr = attr;
                  break;
              }
            }
            if (descriptionAttr) {
              descriptionAttr.remove();
            }
            if (
              !removeDefaultMessage &&
              ast &&
              descriptor.defaultMessage &&
              defaultMessageAttr
            ) {
              defaultMessageAttr
                .get("value")
                .replaceWith(
                  core_1.types.jsxExpressionContainer(
                    core_1.types.stringLiteral("foo")
                  )
                );
              defaultMessageAttr
                .get("value")
                .get("expression")
                .replaceWithSourceString(
                  JSON.stringify(
                    (0, intl_messageformat_parser_1.parse)(
                      descriptor.defaultMessage
                    )
                  )
                );
            }
            if (overrideIdFn || (descriptor.id && idInterpolationPattern)) {
              if (idAttr) {
                idAttr
                  .get("value")
                  .replaceWith(core_1.types.stringLiteral(descriptor.id));
              } else if (defaultMessageAttr) {
                defaultMessageAttr.insertBefore(
                  core_1.types.jsxAttribute(
                    core_1.types.jsxIdentifier("id"),
                    core_1.types.stringLiteral(descriptor.id)
                  )
                );
              }
            }
            if (removeDefaultMessage && defaultMessageAttr) {
              defaultMessageAttr.remove();
            }
            // Tag the AST node so we don't try to extract it twice.
            tagAsExtracted(path);
          }
        }
      },
      CallExpression(
        path,
        {
          opts,
          file: {
            opts: { filename },
          },
        }
      ) {
        const { ReactIntlMessages: messages } = this;
        const {
          moduleSourceName = "react-intl",
          overrideIdFn,
          idInterpolationPattern,
          removeDefaultMessage,
          extractFromFormatMessageCall,
          ast,
        } = opts;
        const callee = path.get("callee");
        /**
         * Process MessageDescriptor
         * @param messageDescriptor Message Descriptor
         */
        function processMessageObject(messageDescriptor) {
          assertObjectExpression(messageDescriptor, callee);
          if (wasExtracted(messageDescriptor)) {
            return;
          }
          const properties = messageDescriptor.get("properties");
          const descriptorPath = createMessageDescriptor(
            properties.map((prop) => [prop.get("key"), prop.get("value")])
          );
          // Evaluate the Message Descriptor values, then store it.
          const descriptor = evaluateMessageDescriptor(
            descriptorPath,
            false,
            filename,
            idInterpolationPattern,
            overrideIdFn
          );
          storeMessage(descriptor, messageDescriptor, opts, filename, messages);
          // Remove description since it's not used at runtime.
          messageDescriptor.replaceWithSourceString(
            JSON.stringify({
              id: descriptor.id,
              ...(!removeDefaultMessage && descriptor.defaultMessage
                ? {
                    defaultMessage: ast
                      ? (0, intl_messageformat_parser_1.parse)(
                          descriptor.defaultMessage
                        )
                      : descriptor.defaultMessage,
                  }
                : {}),
            })
          );
          // Tag the AST node so we don't try to extract it twice.
          tagAsExtracted(messageDescriptor);
        }
        // Check that this is `defineMessages` call
        if (
          isMultipleMessagesDeclMacro(callee, moduleSourceName) ||
          isSingularMessagesDeclMacro(callee, moduleSourceName)
        ) {
          const firstArgument = path.get("arguments")[0];
          const messagesObj = getMessagesObjectFromExpression(firstArgument);
          if (assertObjectExpression(messagesObj, callee)) {
            if (isSingularMessagesDeclMacro(callee, moduleSourceName)) {
              processMessageObject(messagesObj);
            } else {
              const properties = messagesObj.get("properties");
              if (Array.isArray(properties)) {
                properties
                  .map((prop) => prop.get("value"))
                  .forEach(processMessageObject);
              }
            }
          }
        }
        // Check that this is `intl.formatMessage` call
        if (extractFromFormatMessageCall && isFormatMessageCall(callee, path)) {
          const messageDescriptor = path.get("arguments")[0];
          if (messageDescriptor.isObjectExpression()) {
            processMessageObject(messageDescriptor);
          }
        }
      },
    },
  };
});
function isMultipleMessagesDeclMacro(callee, moduleSourceName) {
  return referencesImport(callee, moduleSourceName, ["defineMessages"]);
}
function isSingularMessagesDeclMacro(callee, moduleSourceName) {
  return referencesImport(callee, moduleSourceName, ["defineMessage"]);
}
function getMessagesObjectFromExpression(nodePath) {
  let currentPath = nodePath;
  while (
    (0, types_1.isTSAsExpression)(currentPath.node) ||
    (0, types_1.isTSTypeAssertion)(currentPath.node) ||
    (0, types_1.isTypeCastExpression)(currentPath.node)
  ) {
    currentPath = currentPath.get("expression");
  }
  return currentPath;
}
//# sourceMappingURL=index.js.map
