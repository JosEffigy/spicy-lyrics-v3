function isDev() {
  return typeof __SLdev__m !== "undefined" && __SLdev__m;
}

const App = {
  isDev
}

export default App;