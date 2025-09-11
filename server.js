// server.js
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

// Rota de teste
app.get('/', (req, res) => {
  res.send('Servidor de autenticação rodando.');
});

// Rota para adicionar um endereço
app.post('/auth/add-address', async (req, res) => {
  const { userId, street, number, neighborhood, city, state, zipCode, complement, reference } = req.body;

  if (!userId || !street || !number || !city || !state || !zipCode) {
    return res.status(400).json({ error: 'Campos obrigatórios de endereço não fornecidos (userId, street, number, city, state, zipCode).' });
  }

  try {
    const { data, error } = await supabase
      .from('enderecos')
      .insert([
        {
          user_uuid: userId, // Chave estrangeira para a tabela de usuários
          rua: street,
          numero: number,
          bairro: neighborhood,
          cidade: city,
          estado: state,
          cep: zipCode,
          complemento: complement,
          referencia: reference,
          principal: false // Por padrão, o primeiro endereço adicionado não é o principal, a menos que você ajuste a lógica
        }
      ]);

    if (error) {
      console.error('Erro ao adicionar endereço:', error);
      return res.status(500).json({ error: 'Erro ao salvar o endereço.' });
    }

    res.status(200).json({ message: 'Endereço adicionado com sucesso!', address: data[0] });

  } catch (err) {
    console.error('Erro inesperado ao adicionar endereço:', err);
    res.status(500).json({ error: 'Erro interno do servidor ao adicionar endereço.' });
  }
});

// Rota de Cadastro (/auth/signup) - Modificada para adicionar endereço
app.post('/auth/signup', async (req, res) => {
  const { email, password, name, phone, cpf, birthDate, address } = req.body; // Recebe os dados do endereço

  if (!email || !password || !name || !phone || !cpf || !birthDate) {
    return res.status(400).json({ error: 'Todos os campos de usuário são obrigatórios.' });
  }

  try {
    // 1. Criação do usuário no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (authError) {
      console.error('Erro de cadastro:', authError);
      return res.status(400).json({ error: authError.message });
    }

    if (authData.user) {
      const user = authData.user;

      // 2. Inserção dos dados do cliente na tabela 'clientes'
      const { error: clienteError } = await supabase
        .from('clientes')
        .insert([
          {
            uuid: user.id,
            email: email,
            nome: name,
            cpf: cpf,
            telefone: phone,
            data_nascimento: birthDate,
          }
        ]);

      if (clienteError) {
        console.error('Erro ao inserir dados na tabela clientes:', clienteError);
        // Se o cliente não puder ser salvo, ainda podemos retornar sucesso para o auth
        // mas é bom logar o erro. O usuário terá que completar o perfil depois.
        // Para uma abordagem mais rigorosa, você poderia deletar o usuário recém-criado no auth
        // ou retornar um erro 500 aqui. Por enquanto, permitimos o cadastro do auth.
        console.warn('Aviso: Falha ao salvar informações do cliente, mas usuário de autenticação foi criado.');
        // Se quiser falhar o cadastro do auth se o cliente falhar, descomente a linha abaixo:
        // return res.status(500).json({ error: 'Erro ao salvar informações do cliente.' });
      }

      // 3. Adicionar o endereço do usuário usando a nova rota (se fornecido)
      if (address && user.id) {
        const { error: addressError } = await supabase
          .from('enderecos')
          .insert([
            {
              user_uuid: user.id,
              rua: address.street,
              numero: address.number,
              bairro: address.neighborhood,
              cidade: address.city,
              estado: address.state,
              cep: address.zipCode,
              complemento: address.complement,
              referencia: address.reference,
              principal: true // Define este primeiro endereço como principal
            }
          ]);

        if (addressError) {
          console.error('Erro ao inserir endereço inicial para o novo usuário:', addressError);
          // Similar ao cliente, logamos o erro mas permitimos o cadastro.
          console.warn('Aviso: Falha ao salvar endereço inicial do cliente.');
        } else {
          console.log('Endereço inicial adicionado com sucesso para o novo usuário.');
        }
      }

      res.status(200).json({
        message: 'Usuário cadastrado com sucesso. Verifique seu e-mail para confirmar.',
        user: user,
      });

    } else {
      // Caso o signUp não retorne um user imediatamente (ex: requer email confirmation)
      res.status(200).json({
        message: 'Sucesso. Verifique seu e-mail para confirmação.',
      });
    }

  } catch (err) {
    console.error('Erro inesperado no cadastro:', err);
    res.status(500).json({ error: 'Erro interno do servidor no cadastro.' });
  }
});


// Rota de login
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

    // Ao fazer login, precisamos pegar também os dados do cliente e os endereços
    let userData = data.user;
    let userAddresses = [];

    // Buscar dados do cliente
    const { data: clienteData, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('uuid', userData.id)
      .single(); // Espera um único resultado

    if (clienteError) {
      console.error('Erro ao buscar dados do cliente no login:', clienteError);
      // Continuar mesmo assim, o usuário ainda está logado
    } else {
      userData.clientInfo = clienteData; // Adiciona as informações do cliente ao objeto do usuário
    }

    // Buscar endereços do cliente
    const { data: enderecosData, error: enderecosError } = await supabase
      .from('enderecos')
      .select('*')
      .eq('user_uuid', userData.id);

    if (enderecosError) {
      console.error('Erro ao buscar endereços do cliente no login:', enderecosError);
      // Continuar mesmo assim
    } else {
      userAddresses = enderecosData;
    }

    res.status(200).json({
      message: 'Login bem-sucedido!',
      session: data.session,
      user: {
        ...userData, // Inclui todos os dados do Supabase Auth user
        addresses: userAddresses // Adiciona a lista de endereços
      }
    });
  } catch (err) {
    console.error('Erro inesperado no login:', err);
    res.status(500).json({ error: 'Erro interno do servidor no login.' });
  }
});


app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});