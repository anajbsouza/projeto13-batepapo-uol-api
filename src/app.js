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

const schemaMessage = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message', 'private_message').required()
});


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
    try {
        const participants = await db.collection("participants").find().toArray()
        res.send(participants)
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.post("/messages", async(req, res) => {
    const validation = schemaMessage.validate(req.body, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message);
        return res.status(422).send(errors);
    }

    const from = req.headers.user;
    if(!from) {
        return res.status(422).send("Header 'User' é obrigatório");
    }

    const user = await db.collection("participants").findOne({ name: from });
    if(!user) {
        return res.status(422).send('Participante não está na sala');
    }

    const { to, text, type } = req.body;

    const time = dayjs().format('HH:mm:ss');
    await db.collection("messages").insertOne({ from, to, text, type, time });

    return res.status(201).send();

})

app.get("/messages", async(req, res) => {
    try {
        const user = req.headers.user;
        if(!user) {
            return res.status(422).send("Header 'User' é obrigatório");
        }

        const limit = req.query.limit;
        if(limit !== undefined) {
            const limitNumber = Number(limit);
            if(!Number.isInteger(limitNumber) || limitNumber <= 0) {
                return res.status(422).send("Limit inválido");
            }
        }

        const messagesQuery = db.collection("messages").find({
            $or: [
                { to: user },
                { from: user },
                { type: "message" },
                { to: "Todos" }
            ]
        });

        let messages;
        if(limit !== undefined) {
            messages = await messagesQuery.sort({ time: -1 }).limit(Number(limit)).toArray();
        } else {
            messages = await messagesQuery.toArray();
        }

        res.send(messages);
    } catch (err) {
        res.status(500).send(err.message);
    }
})

app.post("/status", async(req, res) => {
    const user = req.headers.user;
    if (!user) return res.status(404).send();

    const participant = await db.collection("participants").findOne({ name: user });
    if (!participant) return res.status(404).send();

    try {
        await db.collection("participants").updateOne({ name: user } , { $set: { lastStatus: Date.now() } });
        res.status(200).send();
    } catch(err) {
        res.status(500).send(err.message)
    }
})

// deixa o app escutando
const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))