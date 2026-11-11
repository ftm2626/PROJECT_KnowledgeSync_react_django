const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
// Compile application modules in memory for rendering checks; no test-only runtime dependency.
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8').replaceAll('import.meta.env', '({})')
    const result = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true}, fileName: filename})
    module._compile(result.outputText, filename)
  }
}
let selectedLanguage = 'en'
const identity = {token: 'test-only', user: {id: 1, username: 'alex', name: 'Alex Morgan'}}
global.localStorage = {getItem: key => key === 'knowledgesync.language' ? selectedLanguage : key === 'knowledgesync.identity' ? JSON.stringify(identity) : null}
global.window = {location: {hostname: 'localhost', protocol: 'http:'}}
const React = require('react')
const {renderToStaticMarkup} = require('react-dom/server')
const {QueryClient, QueryClientProvider} = require('@tanstack/react-query')
const {LanguageProvider, savedLanguage} = require('../src/i18n')
const {translate, persian} = require('../src/i18n/messages')
const App = require('../src/App').default
const {TopicForm} = require('../src/components/TopicForm')
const {errorMessage} = require('../src/api/client')
const topic = {id: 1, title: 'نمونهٔ فارسی / English example', description: 'متن اصلی موضوع', kind: 'OFFER', status: 'PROPOSED', proposer: identity.user, presenter: identity.user, duration_minutes: 30, vote_count: 3, has_voted: true, scheduled_at: '2030-04-01T10:00:00Z', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z'}
function render(language, element) {
  selectedLanguage = language
  const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: 0}}})
  client.setQueryData(['users'], [identity.user])
  client.setQueryData(['topics', 1], [topic])
  // Layout effects intentionally do not run during server rendering.
  const originalError = console.error
  console.error = (...args) => {if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) originalError(...args)}
  try {return renderToStaticMarkup(React.createElement(QueryClientProvider, {client}, React.createElement(LanguageProvider, null, element)))}
  finally {console.error = originalError; client.clear()}
}
for (const language of ['en', 'fa']) {
  const html = render(language, React.createElement(App))
  assert.ok(html.includes(language === 'fa' ? 'تابلوی رأی‌گیری' : 'Voting board'))
  assert.ok(html.includes(language === 'fa' ? 'ایده‌های بزرگ، جلسه‌های کوتاه.' : 'Big ideas. Small sessions.'))
  assert.ok(html.includes('نمونهٔ فارسی / English example'), 'Authored content must be preserved')
  assert.ok(html.includes('value="votes"'), 'Sort state must use stable identifiers in both languages')
  assert.ok(html.includes(language === 'fa' ? '۳۰' : '30'), 'Card duration should use locale numerals')
  assert.ok(html.includes(language === 'fa' ? 'فروردین' : 'Apr'), 'Session dates must use the selected locale calendar')
  assert.ok(html.includes('lang="fa"') && html.includes('lang="en"'), 'Both language choices must be accessible')
  for (const type of ['propose', 'schedule', 'complete']) {
    const form = render(language, React.createElement(TopicForm, {mode: type === 'propose' ? {type} : {type, topic}, onClose() {}}))
    const fields = type === 'propose' ? ['title', 'description', 'duration_minutes'] : type === 'schedule' ? ['scheduled_at', 'meeting_link', 'duration_minutes'] : ['slides_url']
    for (const field of fields) assert.ok(form.includes('name="' + field + '"'), 'API field names must be language-independent: ' + field)
    assert.ok(form.includes(language === 'fa' ? 'انصراف' : 'Cancel'))
  }
  assert.equal(savedLanguage(), language, 'Saved preference should be restored')
}
assert.equal(translate('fa', 'Presenter: {name}', {name: 'Alex'}), 'ارائه‌دهنده: Alex')
assert.equal(translate('en', 'Presenter: {name}', {name: 'علی'}), 'Presenter: علی')
assert.ok(errorMessage({isAxiosError: true, response: {data: {scheduled_at: ['Choose a future date and time.']}}}, 'fa').includes('تاریخ و ساعتی در آینده انتخاب کنید.'))
assert.ok(errorMessage(new Error('offline'), 'fa').includes('دوباره تلاش کنید'))
for (const file of ['App.tsx', 'components/Modal.tsx', 'components/TopicForm.tsx', 'components/TopicCard.tsx']) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  function check(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 't' && ts.isStringLiteral(node.arguments[0])) {
      assert.ok(persian[node.arguments[0].text], 'Missing Persian translation: ' + node.arguments[0].text)
    }
    ts.forEachChild(node, check)
  }
  check(ast)
}
console.log('Bilingual checks passed: page and form rendering, Persian numerals, preserved content and API identifiers, stored preference, translated errors, and catalog coverage.')
