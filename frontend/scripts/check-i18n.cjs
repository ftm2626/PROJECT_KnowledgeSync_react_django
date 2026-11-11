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
const {AuthProvider} = require('../src/auth/AuthProvider')
const {api, readIdentity, writeIdentity, subscribeIdentity} = require('../src/api/client')
const {AxiosError} = require('axios')
const {TopicForm} = require('../src/components/TopicForm')
const {TopicCard} = require('../src/components/TopicCard')
const {errorMessage} = require('../src/api/client')
const topic = {id: 1, title: 'نمونهٔ فارسی / English example', description: 'متن اصلی موضوع', kind: 'OFFER', status: 'PROPOSED', proposer: identity.user, presenter: identity.user, duration_minutes: 30, vote_count: 3, has_voted: true, scheduled_at: '2030-04-01T10:00:00Z', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z'}
function render(language, element, {authenticated = true, verified = true} = {}) {
  writeIdentity(authenticated ? identity : null)
  selectedLanguage = language
  const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: 0}}})
  if (authenticated && verified) client.setQueryData(['auth', 'me', identity.token], identity.user)
  client.setQueryData(['topics', 1], [topic])
  // Layout effects intentionally do not run during server rendering.
  const originalError = console.error
  console.error = (...args) => {if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) originalError(...args)}
  try {return renderToStaticMarkup(React.createElement(QueryClientProvider, {client}, React.createElement(LanguageProvider, null, React.createElement(AuthProvider, null, element))))}
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
  for (const type of ['propose', 'schedule', 'complete', 'edit', 'delete']) {
    const form = render(language, React.createElement(TopicForm, {mode: type === 'propose' ? {type} : {type, topic}, onClose() {}}))
    const fields = type === 'propose' || type === 'edit' ? ['title', 'description', 'duration_minutes'] : type === 'schedule' ? ['scheduled_at', 'meeting_link', 'duration_minutes'] : type === 'complete' ? ['slides_url'] : []
    for (const field of fields) assert.ok(form.includes('name="' + field + '"'), 'API field names must be language-independent: ' + field)
    assert.ok(form.includes(language === 'fa' ? 'انصراف' : 'Cancel'))
    if (type === 'edit') {
      assert.ok(form.includes('value="' + topic.title + '"'), 'Edit form must preload the title')
      assert.ok(form.includes(topic.description), 'Edit form must preload the description')
      assert.ok(form.includes(language === 'fa' ? 'ذخیرهٔ تغییرات' : 'Save changes'))
    }
    if (type === 'delete') {
      assert.ok(form.includes(language === 'fa' ? 'قابل بازگشت نیست' : 'This cannot be undone.'))
      assert.ok(!form.includes('name="title"'), 'Deletion needs confirmation rather than edit fields')
    }
  }
  for (const state of ['PROPOSED', 'SCHEDULED', 'COMPLETED']) {
    const props = {topic: {...topic, status: state}, user: identity.user, busy: false, onVote() {}, onClaim() {}, onForm() {}}
    const own = render(language, React.createElement(TopicCard, props))
    assert.ok(own.includes(language === 'fa' ? 'ویرایش ایده:' : 'Edit idea:'), 'Creator can edit at every stage')
    assert.ok(own.includes(language === 'fa' ? 'حذف ایده:' : 'Delete idea:'), 'Creator can delete at every stage')
    const other = render(language, React.createElement(TopicCard, {...props, topic: {...props.topic, proposer: {...identity.user, id: 2}}}))
    assert.ok(!other.includes(language === 'fa' ? 'ویرایش ایده:' : 'Edit idea:'), 'Presenters cannot edit someone else’s idea')
    assert.ok(!other.includes(language === 'fa' ? 'حذف ایده:' : 'Delete idea:'), 'Presenters cannot delete someone else’s idea')
  }
  const lockedForm = render(language, React.createElement(TopicForm, {mode: {type: 'edit', topic: {...topic, status: 'SCHEDULED'}}, onClose() {}}))
  assert.ok(lockedForm.includes('<fieldset disabled="">'), 'Scheduled topic types must be locked in the form')
  const anonymous = render(language, React.createElement(App), {authenticated: false})
  assert.ok(anonymous.includes(language === 'fa' ? 'نام کاربری' : 'Username'))
  assert.ok(anonymous.includes('name="username"') && anonymous.includes('autoComplete="username"'))
  assert.ok(anonymous.includes('type="password"') && anonymous.includes('autoComplete="current-password"'))
  assert.ok(!anonymous.includes(topic.title) && !anonymous.includes('Voting board'), 'Logged-out screen must not expose the board')
  const checking = render(language, React.createElement(App), {verified: false})
  assert.ok(checking.includes(language === 'fa' ? 'در حال بررسی ورود شما' : 'Checking your sign-in'))
  assert.ok(!checking.includes(topic.title), 'An unverified stored identity must not expose team data')
  assert.ok(html.includes(language === 'fa' ? 'خروج' : 'Sign out'))
  assert.equal(savedLanguage(), language, 'Saved preference should be restored')
}
assert.equal(translate('fa', 'Presenter: {name}', {name: 'Alex'}), 'ارائه‌دهنده: Alex')
assert.equal(translate('en', 'Presenter: {name}', {name: 'علی'}), 'Presenter: علی')
assert.ok(errorMessage({isAxiosError: true, response: {data: {scheduled_at: ['Choose a future date and time.']}}}, 'fa').includes('تاریخ و ساعتی در آینده انتخاب کنید.'))
assert.ok(errorMessage(new Error('offline'), 'fa').includes('دوباره تلاش کنید'))
for (const file of ['App.tsx', 'components/Modal.tsx', 'components/TopicForm.tsx', 'components/TopicCard.tsx', 'auth/LoginScreen.tsx', 'components/LanguageSwitch.tsx']) {
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
async function checkTokenInvalidation() {
  let notifications = 0
  const unsubscribe = subscribeIdentity(() => { notifications++ })
  writeIdentity(identity)
  notifications = 0
  const reject401 = config => Promise.reject(new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {status: 401, data: {detail: 'Invalid token.'}, headers: {}, config}))
  await api.get('topics/', {adapter: reject401}).catch(() => {})
  assert.equal(readIdentity(), null, 'Protected API 401 must clear the stored identity')
  assert.equal(notifications, 1, 'Auth boundary must be notified once to clear cached queries')
  writeIdentity(identity)
  await api.post('auth/login/', {username: 'wrong', password: 'wrong'}, {adapter: reject401}).catch(() => {})
  assert.equal(readIdentity(), identity, 'A rejected login must not trigger protected-session invalidation')
  await api.get('topics/', {adapter: config => {
    writeIdentity({...identity, token: 'new-login-token'})
    return reject401(config)
  }}).catch(() => {})
  assert.equal(readIdentity().token, 'new-login-token', 'A delayed old request must not clear a new login')
  unsubscribe()
  writeIdentity(null)
}
checkTokenInvalidation().then(() => console.log('Bilingual/auth checks passed: login gate, stored-token validation, authenticated board, API 401 invalidation, request races, translated forms and errors, dates, numbers, and catalog coverage.')).catch(error => {console.error(error); process.exitCode = 1})
