/** 阻止浏览器自动翻译、拼写检查与扩展改写中文输入 */
export const editableInputProps = {
  translate: "no" as const,
  spellCheck: false,
  autoCorrect: "off" as const,
  autoCapitalize: "off" as const,
  autoComplete: "off" as const,
  lang: "zh-CN",
  "data-gramm": "false",
  "data-gramm_editor": "false",
  "data-enable-grammarly": "false",
};

export const editableInputClassName = "notranslate";
