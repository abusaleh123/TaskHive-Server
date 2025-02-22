require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "https://task-management-ee2d6.web.app",
     methods: ["GET", "POST"],
   },
});

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tmru0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    

    const userCollection = client.db("Task-Mangement").collection("users");
    const taskCollection = client.db("Task-Mangement").collection("tasks");

    //  MongoDB Change Stream for Real-time Updates
    const changeStream = taskCollection.watch();
    changeStream.on("change", (change) => {
      console.log("Database Change Detected:", change);
      io.emit("taskUpdated", { type: change.operationType, data: change });
    });

    //  API Routes
    app.get("/", (req, res) => res.send("Hello World"));

    app.post("/add-user", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const check = await userCollection.findOne(query);
      if (!check) {
        const result = await userCollection.insertOne(user);
        res.send(result);
      }
    });

    app.get("/tasks", async (req, res) => {
      const email = req.query.email
      const query = {email: email}
      const result = await taskCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/tasks", async (req, res) => {
      const task = req.body;
      const result = await taskCollection.insertOne(task);
      io.emit("taskUpdated"); 
      res.send(result);
    });

    app.post("/update-task", async (req, res) => {
      const { _id, category } = req.body;
      await taskCollection.updateOne({ _id: new ObjectId(_id) }, { $set: { category } });
      io.emit("taskUpdated"); 
      res.json({ message: "Task updated" });
    });

    app.post("/update-order", async (req, res) => {
      const { category, tasks } = req.body;

      const bulkOps = tasks.map((task, index) => ({
        updateOne: {
          filter: { _id: new ObjectId(task._id) },
          update: { $set: { order: index } },
        },
      }));

      await taskCollection.bulkWrite(bulkOps);
      io.emit("taskUpdated"); 
      res.json({ message: "Order updated" });
    });

    app.delete('/task', async (req, res) => {
        const id = req.query.id
        const query = {_id: new ObjectId(id)}
        const result = await taskCollection.deleteOne(query)
        res.send(result)
    })

    app.patch('/task', async(req, res) => {
        const task = req.body
        const query = {_id : new ObjectId(task.id)}
        const options = {upsert: true}
        const updateTask ={
            $set: {
                title: task.title,
                description: task.description
            }
        }
        const result = await taskCollection.updateOne(query, updateTask, options)
        res.send(result)

    })






  } catch (error) {
    console.error("Error:", error);
  }
}
run().catch(console.dir);


server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
