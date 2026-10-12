import dns from "dns";

dns.resolveSrv(
  "_mongodb._tcp.collabrative-markdown-e.s9eb9hu.mongodb.net",
  (err, addresses) => {
    console.log(err);
    console.log(addresses);
  }
);