import index from "./index";
const log = console.log

log('____________RUN _________________')
// const index = () => "index";

// console.log("\n\nHas index been transpiled?\n" + index());
// log("\n\nHas message been transpiled?\n" + index());

index()
  .then(res=> {
    log('_______md:', res)
  })
