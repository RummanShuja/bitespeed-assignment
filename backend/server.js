import dotenv from 'dotenv'
import express from 'express'
import mysql from 'mysql2/promise'

dotenv.config();
const app = express();
const PORT = 3000;

const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

db.connect((err)=>{
    if(err){
        console.log("DB connection failed: ", err );
    }else{
        console.log("Connected to Database");
    }
});

app.get('/', (req, res)=>{
    res.send("Api working");
})

app.listen(PORT, ()=>{
    console.log(`Server is listening to port: ${PORT}`);
})