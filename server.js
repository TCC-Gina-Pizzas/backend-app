
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const cors = require('cors');


const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);


const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());


app.get('/', (req, res) => {
  res.send('Servidor de autenticação rodando.');
});


app.post('/auth/signup', async (req, res) => {
  const { email, password, name } = req.body; 

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'E-mail, senha e nome são obrigatórios.' });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: name, 
        },
      },
    });

    if (error) {
      console.error('Erro de cadastro:', error);
      return res.status(400).json({ error: error.message });
    }

    if (data.user) {
      res.status(200).json({
        message: 'Usuário cadastrado com sucesso. Verifique seu e-mail para confirmar.',
        user: data.user,
      });
    } else {
      res.status(200).json({
        message: 'Sucesso. Verifique seu e-mail para confirmação.',
      });
    }
  } catch (err) {
    console.error('Erro inesperado:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});


app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      console.error('Erro de login:', error);
      return res.status(401).json({ error: error.message });
    }

    res.status(200).json({
      message: 'Login bem-sucedido!',
      session: data.session,
      user: data.user, 
    });
  } catch (err) {
    console.error('Erro inesperado:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});