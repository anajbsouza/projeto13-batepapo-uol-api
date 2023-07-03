import joi from "joi";
import cors from "cors";
import dayjs from "dayjs";
import dotenv from "dotenv";
import express, { application } from "express";
import { MongoClient, ObjectId } from "mongodb";

// criando servidor
const app = express();

// configurações
app.use(cors());
app.use(express.json());
dotenv.config();

// conexão com banco de dados
const mongoClient = new MongoClient(process.env.DATABASE_URL);

try {
    await mongoClient.connect()
    console.log('MongoDB conectado!')
} catch (err) {
    console.log(err.message)
}

const db = mongoClient.db()

// schemas
const schemaParticipant = joi.object({ name: joi.string().required()});

// funções
app.post("/participants", async(req, res) => {
    const { name } = req.body;

    const validation = schemaParticipant.validate(req.body, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message);
        return res.status(422).send(errors);

    }
    try {
        const nome = await db.collection("participants").findOne({ name });
        if(nome) return res.status(409).send('Nome já está sendo usado');

        // adicionar o participante
        await db.collection("participants").insertOne({ name, lastStatus: Date.now() });

        // adicionar a mensagem
        const time = dayjs().format('HH:mm:ss');
        await db.collection("messages").insertOne({ from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time });

        return res.status(201).send();

    } catch(err) {
        return res.status(500).send(err.message);
    }
})

app.get("/participants", async(req, res) => {

})

app.post("/messages", async(req, res) => {

})

app.get("/messages", async(req, res) => {

})

app.post("/status", async(req, res) => {

})

// deixa o app escutando
const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))