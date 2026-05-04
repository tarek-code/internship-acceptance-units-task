const express = require('express');
const app = express();

app.use(express.json());

let data=[];

app.get('/',(req,res)=>{
    res.send("api is working");
});

app.get("/items",(req,res)=>{
    res.json(data);
});

app.post("/items",(req,res)=>{
    const item = req.body;
    data.push(item);
    res.status(201).json(item);
});

const PORT = 3000;

app.listen(PORT,"0.0.0.0",()=>{
    console.log(`Server is running on port ${PORT}`);
});