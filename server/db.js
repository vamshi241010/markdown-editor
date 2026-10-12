import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import dotenv from "dotenv"
export const PDF_DIR = path.join(process.cwd(), "uploads");

if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}
dotenv.config();
const mongoUri = process.env.MONGODB_URI;
 //"mongodb://127.0.0.1:27017/collaborative-editor";
const maskedUri = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
console.log(`Database Connection: Connecting to MongoDB at ${maskedUri}`);

mongoose.connect(mongoUri, {
  serverSelectionTimeoutMS: 5000,
}).then(() => {
  console.log("Database Connect Status: Connected successfully to MongoDB.");
}).catch((err) => {
  console.error("Database Connection failure: Error establishing MongoDB connection:", err.message);
});

export default mongoose;


// import mongoose from "mongoose";
// import path from "path";
// import fs from "fs";
// import dotenv from "dotenv"
// export const PDF_DIR = path.join(process.cwd(), "uploads");

// if (!fs.existsSync(PDF_DIR)) {
//   fs.mkdirSync(PDF_DIR, { recursive: true });
// }
// dotenv.config();
// //const mongoUri = process.env.MONGODB_URI || "mongodb://pisinidurga77_db_user:242010870816@ac-tm0aibi-shard-00-00.s9eb9hu.mongodb.net:27017,ac-tm0aibi-shard-00-01.s9eb9hu.mongodb.net:27017,ac-tm0aibi-shard-00-02.s9eb9hu.mongodb.net:27017/?ssl=true&replicaSet=atlas-3bm1th-shard-0&authSource=admin&appName=Collabrative-MarkDown-Editor";
// const mongoUri = process.env.MONGODB_URI
// // Debug logging
// console.log("Environment Check:");
// console.log("NODE_ENV:", process.env.NODE_ENV);
// console.log("MONGODB_URI set?:", !!mongoUri);

// if (!mongoUri) {
//   console.error("❌ MONGODB_URI is not set in environment variables!");
//   console.error("Make sure .env file exists and contains MONGODB_URI");
//   process.exit(1);
// }

// const maskedUri = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
// console.log(`Database Connection: Connecting to MongoDB at ${maskedUri}`);

// mongoose.connect(mongoUri, {
//   serverSelectionTimeoutMS: 10000,
//   socketTimeoutMS: 45000,
// })
// .then(() => {
//   console.log("✓ Database Connect Status: Connected successfully to MongoDB.");
// })
// .catch((err) => {
//   console.error("✗ Database Connection failure:", err.message);
  
//   if (err.message.includes("getaddrinfo")) {
//     console.error("→ Check: IP whitelisted in MongoDB Atlas Network Access");
//   } else if (err.message.includes("authentication failed")) {
//     console.error("→ Check: Username/password in MONGODB_URI");
//   } else if (err.message.includes("ECONNREFUSED")) {
//     console.error("→ Check: Cluster is running (not paused)");
//   }
  
//   process.exit(1); // Exit so we know connection failed
// });

// export default mongoose;