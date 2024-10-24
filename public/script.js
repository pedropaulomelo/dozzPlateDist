// script.js
feather.replace();

// Store the fetched data globally for filtering
let cadastrosData = [];
let runningIPs = [];

// Function to toggle the sidebar (remains unchanged)
const sidebarToggle = () => {
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('content');
  sidebar.classList.toggle('active');
  content.classList.toggle('active');
};

// Event listener for the sidebar toggle button (remains unchanged)
document.getElementById('sidebarCollapse').addEventListener('click', sidebarToggle);

// Function to load Cadastros
const loadCadastros = () => {
  const mainContent = document.getElementById('main-content');
  document.getElementById('page-title').innerText = 'Cadastros';

  // Fetch data from the backend
  Promise.all([
    fetch('/plates').then(response => {
      if (!response.ok) {
        throw new Error('Erro ao buscar dados de cadastros.');
      }
      return response.json();
    }),
    fetch('/process-status').then(response => response.json())
  ])
    .then(([data, processStatus]) => {
      cadastrosData = data; // Store data globally
      runningIPs = processStatus.runningIPs; // Update the global runningIPs
      renderCadastrosTable(cadastrosData); // Initial render
    })
    .catch(error => {
      console.error(error);
      mainContent.innerHTML = `<p>Erro ao carregar cadastros. Tente novamente mais tarde.</p>`;
    });
};

// Function to render the table with filters and status
const renderCadastrosTable = (data, runningIPs) => {
  const mainContent = document.getElementById('main-content');

  // Create a mapping of 'Grupo' to their 'Unidades'
  const grupoUnidadeMap = {};
  data.forEach(user => {
    const grupo = user.grupo;
    const unid = user.unid;

    if (!grupoUnidadeMap[grupo]) {
      grupoUnidadeMap[grupo] = new Set();
    }
    grupoUnidadeMap[grupo].add(unid);
  });

  // Extract unique 'Grupo' values
  const grupos = Object.keys(grupoUnidadeMap).sort();

  // Create filter inputs
  const filtersHTML = `
    <div class="filter-container">
      <input type="text" id="filter-nome" placeholder="Filtrar por Nome">
      <select id="filter-grupo">
        <option value="">Selecione um Grupo</option>
        ${grupos.map(grupo => `<option value="${grupo}">${grupo}</option>`).join('')}
      </select>
      <select id="filter-unidade" disabled>
        <option value="">Selecione uma Unidade</option>
      </select>
    </div>
  `;

  let tableHTML = `
    <table id="cadastros-table">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Grupo</th>
          <th>Unidade</th>
          <th>Placas</th>
          <th></th> <!-- Botão de expansão -->
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach((user, index) => {
    // Extract plates from devices array
    const plates = user.devices && user.devices.length > 0
      ? user.devices.map(device => device.plate).join(' / ')
      : 'Nenhuma';

    tableHTML += `
      <tr data-index="${index}">
        <td>${user.userName}</td>
        <td>${user.grupo}</td>
        <td>${user.unid}</td>
        <td>${plates}</td>
        <td class="expand-button-cell">
          <button class="expand-button">+</button>
        </td>
      </tr>
    `;
  });

  tableHTML += `
      </tbody>
    </table>
  `;

  mainContent.innerHTML = filtersHTML + tableHTML;

  // Store the grupoUnidadeMap for later use
  window.grupoUnidadeMap = grupoUnidadeMap;

  // Add event listeners to filter inputs
  document.getElementById('filter-nome').addEventListener('input', filterCadastros);
  document.getElementById('filter-grupo').addEventListener('change', handleGrupoChange);
  document.getElementById('filter-unidade').addEventListener('change', filterCadastros);

  // Add event listeners to expand buttons
  const expandButtons = document.querySelectorAll('.expand-button');
  expandButtons.forEach(button => {
    button.addEventListener('click', handleExpandClick);
  });
};

const renderCadastrosTableRows = (data) => {
  const tbody = document.querySelector('#main-content table tbody');
  let rowsHTML = '';

  data.forEach(user => {
    const index = cadastrosData.indexOf(user);
    // Extract plates from devices array
    const plates = user.devices && user.devices.length > 0
      ? user.devices.map(device => device.plate).join(' / ')
      : 'Nenhuma';

    rowsHTML += `
      <tr data-index="${index}">
        <td>${user.userName}</td>
        <td>${user.grupo}</td>
        <td>${user.unid}</td>
        <td>${plates}</td>
        <td class="expand-button-cell">
          <button class="expand-button">+</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHTML;

  // Re-attach event listeners to expand buttons
  const expandButtons = document.querySelectorAll('.expand-button');
  expandButtons.forEach(button => {
    button.addEventListener('click', handleExpandClick);
  });
};

// Function to handle changes in the 'Grupo' select
const handleGrupoChange = () => {
  const grupoSelect = document.getElementById('filter-grupo');
  const unidadeSelect = document.getElementById('filter-unidade');
  const selectedGrupo = grupoSelect.value;

  // Clear the 'Unidade' select options
  unidadeSelect.innerHTML = '';

  if (selectedGrupo === '') {
    // No 'Grupo' selected, disable 'Unidade' select
    unidadeSelect.disabled = true;
    unidadeSelect.innerHTML = '<option value="">Selecione uma Unidade</option>';
  } else {
    // 'Grupo' selected, enable 'Unidade' select and populate options
    unidadeSelect.disabled = false;

    const unidades = Array.from(window.grupoUnidadeMap[selectedGrupo]).sort();

    unidadeSelect.innerHTML = `
      <option value="">Todas as Unidades</option>
      ${unidades.map(unid => `<option value="${unid}">${unid}</option>`).join('')}
    `;
  }

  // Trigger filtering when 'Grupo' changes
  filterCadastros();
};

// Function to handle the expand/collapse functionality
const handleExpandClick = (event) => {
  const button = event.target;
  const row = button.closest('tr');
  const index = row.getAttribute('data-index');
  const user = cadastrosData[index];

  // Toggle expanded state
  if (row.classList.contains('expanded')) {
    // Collapse
    row.classList.remove('expanded');
    button.textContent = '+';
    // Remove expanded rows
    const nextRows = [];
    let nextRow = row.nextElementSibling;
    while (nextRow && nextRow.classList.contains('expanded-row')) {
      nextRows.push(nextRow);
      nextRow = nextRow.nextElementSibling;
    }
    nextRows.forEach(nr => nr.remove());
  } else {
    // Expand
    row.classList.add('expanded');
    button.textContent = '-';
    // Insert expanded rows
    const devices = user.devices || [];
    let insertHTML = '';
    devices.forEach(device => {
      insertHTML += `
        <tr class="expanded-row">
          <td></td> <!-- Empty cell to align with the main table -->
          <td colspan="5">
            <table class="inner-table">
              <thead>
                <tr>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Cor</th>
                  <th>Placa</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${device.make || ''}</td>
                  <td>${device.model || ''}</td>
                  <td>${device.color || ''}</td>
                  <td>${device.plate || ''}</td>
                  <td>${device.status ? 'Ativo' : 'Inativo'}</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      `;
    });
    row.insertAdjacentHTML('afterend', insertHTML);
  }
};

// Function to filter cadastrosData based on input values
const filterCadastros = () => {
  const nomeFilter = document.getElementById('filter-nome').value.toLowerCase();
  const grupoFilter = document.getElementById('filter-grupo').value;
  const unidadeSelect = document.getElementById('filter-unidade');
  const unidadeFilter = unidadeSelect.disabled ? '' : unidadeSelect.value;

  const filteredData = cadastrosData.filter(user => {
    const nomeMatch = user.userName.toLowerCase().includes(nomeFilter);
    const grupoMatch = grupoFilter === '' || user.grupo === grupoFilter;
    const unidadeMatch = unidadeFilter === '' || user.unid === unidadeFilter;

    return nomeMatch && grupoMatch && unidadeMatch;
  });

  // Re-render the table with the filtered data
  renderCadastrosTableRows(filteredData);
};

// Connect to the Socket.IO server
const socket = io();

// Keep track of the current snack message and its timeout
let currentSnack = null;
let snackTimeout = null;

// Function to display snack messages
const showSnackMessage = (message, type = 'info') => {
  // If there's a current snack message, remove it with fade-out
  if (currentSnack) {
    // Add fade-out class for animation
    currentSnack.classList.add('fade-out');
    // Remove the element after the fade-out transition
    setTimeout(() => {
      currentSnack.remove();
    }, 500); // Duration matches the CSS transition
    currentSnack = null;
  }
  // If there's an existing timeout, clear it
  if (snackTimeout) {
    clearTimeout(snackTimeout);
    snackTimeout = null;
  }

  // Create a div element for the snack message
  const snack = document.createElement('div');
  snack.className = `snack-message ${type}`;
  snack.textContent = message;

  // Append to the body
  document.body.appendChild(snack);

  // Store the current snack and timeout
  currentSnack = snack;
  snackTimeout = setTimeout(() => {
    // Add fade-out class for animation
    snack.classList.add('fade-out');
    // Remove the element after the fade-out transition
    setTimeout(() => {
      snack.remove();
      currentSnack = null;
      snackTimeout = null;
    }, 500); // Duration matches the CSS transition
  }, 3000);
};

// Function to load Configurações
// Function to load Configurações
const loadConfiguracoes = () => {
  const mainContent = document.getElementById('main-content');
  document.getElementById('page-title').innerText = 'Configurações';

  // Fetch data from the backend
  Promise.all([
    fetch('/settings').then(response => response.json()),
    fetch('/process-status').then(response => response.json()),
    fetch('/mg3000-config').then(response => response.json())
  ])
    .then(([data, processStatus, mg3000Data]) => {
      const runningIPs = processStatus.runningIPs;

      // HTML for the first table (existing one)
      let tableHTML = `
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Equipamento</th>
                <th>Canal</th>
                <th>Endereço IP</th>
                <th>Usuário</th>
                <th>Senha</th>
                <th>Status</th>
                <th>Ações</th> 
              </tr>
            </thead>
            <tbody>
      `;

      data.forEach((camera, index) => {
        const isRunning = runningIPs.includes(camera.equipAdd);
        const buttonStatus = isRunning ? 'running' : 'stopped';
        const buttonIcon = isRunning ? 'square' : 'play';
        const buttonTitle = isRunning ? 'Stop' : 'Play';
      
        // Determinar a cor inicial do círculo de status
        const statusColor = isRunning ? 'green' : 'red';
      
        // Mapear channelOccupied para número
        const channelMap = {
          'chan1': '1',
          'chan2': '2',
          'chan3': '3',
          'chan4': '4'
        };
      
        // Obter o número do canal ocupado
        const channelOccupied = channelMap[camera.channelOccupied] || 'N/A';
      
        tableHTML += `
          <tr>
            <td>${camera.equipType || 'Câmera IP'}</td>
            <td>${channelOccupied}</td>
            <td>${camera.equipAdd || ''}</td>
            <td>${camera.equipUser || ''}</td>
            <td>${'*'.repeat(8)}</td>
            <td><span class="status-circle ${statusColor}"></span></td>
            <td>
              <button class="play-button" data-index="${index}" data-status="${buttonStatus}" title="${buttonTitle}">
                <i data-feather="${buttonIcon}"></i>
              </button>
            </td>
          </tr>
        `;
      });

      tableHTML += `
            </tbody>
          </table>
        </div>
      `;

      // HTML for the second table (new one with input fields)
      let secondTableHTML = `
        <div class="table-container">
          <form id="mg3000-form">
            <table>
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Endereço do MG3000</th>
                  <th>Endereço da Receptora</th>
                  <th>Endereço da Porta</th>
                </tr>
              </thead>
              <tbody>
      `;

      // Criar um objeto para acesso fácil às configurações por canal
      const mg3000ConfigByChannel = {};
      mg3000Data.forEach(config => {
        mg3000ConfigByChannel[config.channel] = config;
      });

      // Gerar as linhas da tabela com os campos preenchidos
      for (let channel = 1; channel <= 4; channel++) {
        const config = mg3000ConfigByChannel[channel] || {};
        secondTableHTML += `
          <tr>
            <td>Canal ${channel}</td>
            <td><input type="text" name="mg3000Address_${channel}" placeholder="Endereço do MG3000" value="${config.mg3000Address || ''}"></td>
            <td><input type="text" name="receptorAddress_${channel}" placeholder="Endereço da Receptora" value="${config.receptorAddress || ''}"></td>
            <td><input type="text" name="portAddress_${channel}" placeholder="Endereço da Porta" value="${config.portAddress || ''}"></td>
          </tr>
        `;
      }

      secondTableHTML += `
              </tbody>
            </table>
            <div class="form-actions">
              <button type="submit" class="btn-save">Salvar</button>
            </div>
          </form>
        </div>
      `;

      // Combine both tables
      mainContent.innerHTML = `
        <div class="configuracoes-container">
          <div class="configuracoes-top">
            ${tableHTML}
          </div>
          <div class="configuracoes-bottom">
            ${secondTableHTML}
          </div>
        </div>
      `;

      // Re-render Feather icons
      feather.replace();

      // Add event listeners to play buttons
      const playButtons = document.querySelectorAll('.play-button');
      playButtons.forEach(button => {
        button.addEventListener('click', handlePlayButtonClick);
      });

      // Add event listener to the form submission
      document.getElementById('mg3000-form').addEventListener('submit', handleMG3000FormSubmit);
    })
    .catch(error => {
      console.error(error);
      mainContent.innerHTML = `<p>Erro ao carregar configurações. Tente novamente mais tarde.</p>`;
    });
};

// Function to handle MG3000 form submission
const handleMG3000FormSubmit = (event) => {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);

  // Prepare the data to send to the backend
  const dataToSend = [];

  for (let channel = 1; channel <= 4; channel++) {
    const mg3000Address = formData.get(`mg3000Address_${channel}`);
    const receptorAddress = formData.get(`receptorAddress_${channel}`);
    const portAddress = formData.get(`portAddress_${channel}`);

    dataToSend.push({
      channel,
      mg3000Address,
      receptorAddress,
      portAddress
    });
  }

  // Send data to the backend (you need to implement the backend endpoint)
  fetch('/save-mg3000-config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dataToSend)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Erro ao salvar configurações do MG3000.');
      }
      return response.json();
    })
    .then(result => {
      console.log(result.message);
      showSnackMessage('Configurações salvas com sucesso!', 'success');
    })
    .catch(error => {
      console.error(error);
      showSnackMessage('Não foi possível salvar as configurações.', 'error');
    });
};

// Function to handle Play/Stop button click
const handlePlayButtonClick = (event) => {
  const button = event.currentTarget;
  const index = button.getAttribute('data-index');
  const status = button.getAttribute('data-status');

  // Change button to loading state
  button.setAttribute('data-status', 'loading');
  button.setAttribute('title', 'Iniciando...');
  button.innerHTML = '<i data-feather="loader"></i>';
  feather.replace();

  // Adicionar a notificação de "Iniciando o Serviço"
  showSnackMessage('Iniciando o serviço, por favor aguarde...', 'info');

  let camera;

  fetch('/settings')
    .then(response => response.json())
    .then(data => {
      console.log(data)
      camera = data[index];

  // Encontrar o IP da câmera correspondente
  const ip = camera.equipAdd;

  // Atualizar o círculo de status para amarelo
  updateStatusCircle(ip, 'loading');

  // Disable the button to prevent multiple clicks
  button.disabled = true;

  // Iniciar o reconhecimento ou parar com base no status atual
  if (status === 'stopped') {
    // Start the recognition process
    fetch('/start-recognition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ip: camera.equipAdd,
        user: camera.equipUser,
        password: camera.equipPass
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Erro ao iniciar o reconhecimento.');
      }
      return response.json();
    })
    .then(result => {
      console.log(result.message);
      // Aguardaremos o evento 'process-started' para atualizar a UI
    })
    .catch(error => {
      console.error(error);
      showSnackMessage('Não foi possível iniciar o reconhecimento.', 'error');
      // Reset the button back to Play
      button.setAttribute('data-status', 'stopped');
      button.setAttribute('title', 'Play');
      button.innerHTML = '<i data-feather="play"></i>';
      feather.replace();
      button.disabled = false;
      
      // Atualizar o círculo de status para vermelho
      updateStatusCircle(ip, 'stopped');
    });
  } else if (status === 'running') {
    // Stop the recognition process
    fetch('/stop-recognition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ip: camera.equipAdd
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Erro ao parar o reconhecimento.');
      }
      return response.json();
    })
    .then(result => {
      console.log(result.message);
      // Aguardaremos o evento 'process-stopped' para atualizar a UI
    })
    .catch(error => {
      console.error(error);
      showSnackMessage('Não foi possível parar o reconhecimento.', 'error');
      // Reset the button back to Stop
      button.setAttribute('data-status', 'running');
      button.setAttribute('title', 'Stop');
      button.innerHTML = '<i data-feather="square"></i>';
      feather.replace();
      button.disabled = false;
      
      // Atualizar o círculo de status para vermelho (já está parado)
      updateStatusCircle(ip, 'stopped');
    });
  }
  })
};

// Helper function to update the status circle by IP address
const updateStatusCircle = (ip, status) => {
  const rows = document.querySelectorAll('#main-content table tbody tr');
  for (const row of rows) {
    const ipCell = row.cells[2]; 
    if (ipCell && ipCell.textContent.trim() === ip) {
      const statusCell = row.cells[5];
      const statusCircle = statusCell.querySelector('.status-circle');
      if (statusCircle) {
        // Remove previous color classes
        statusCircle.classList.remove('green', 'red', 'yellow');
        
        // Add new color class based on status
        if (status === 'running') {
          statusCircle.classList.add('green');
        } else if (status === 'stopped') {
          statusCircle.classList.add('red');
        } else if (status === 'loading') {
          statusCircle.classList.add('yellow');
        }
      }
      break;
    }
  }
};

const setupControleSocket = () => {
  // Remover event listeners anteriores para evitar múltiplas ligações
  socket.off('plate-found');
  socket.off('process-status');

  // Escutar o evento 'plate-detected' para atualizações
  socket.on('plate-found', (data) => {
    console.log(data)
    // data deve conter: channelNumber, customerInfo, timestamp, etc.
    updateControleTable(data);
  });

  // Escutar o evento 'process-status' para atualizar o letreiro
  socket.on('process-status', (status) => {
    updateStatusMarquee(status);
  });
};

// Função para gerar o SVG da placa
const generatePlateSVG = (plateNumber) => {
  // Caminho para o template da placa
  const templatePath = '/assets/plates/plate_template.svg';

  // Obter os caracteres individuais da placa
  const characters = plateNumber.toUpperCase().split('');

  // Dimensões e posições iniciais
  const plateWidth = 260; // Largura do template da placa
  const plateHeight = 55; // Altura do template da placa

  // Definir dimensões dos caracteres
  const charWidth = 18; // Largura dos caracteres
  const charHeight =27; // Altura dos caracteres

  // Espaçamento entre os caracteres
  const charSpacing = 2; // Espaço entre os caracteres

  // Número total de caracteres na placa
  const totalChars = characters.length;

  // Calcular a largura total dos caracteres e espaços
  const totalCharsWidth = (charWidth * totalChars) + (charSpacing * (totalChars - 1));

  // Calcular a posição inicial para centralizar os caracteres
  const startX = (plateWidth - totalCharsWidth) / 2;
  const startY = (plateHeight - charHeight) / 2 + 7;

  // Iniciar o SVG com o template da placa
  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${plateWidth}" height="${plateHeight}">`;

  // Adicionar o template da placa
  svgContent += `<image href="${templatePath}" x="0" y="0" width="${plateWidth}" height="${plateHeight}" />`;

  // Adicionar os caracteres
  characters.forEach((char, index) => {
    // Calcular a posição x do caractere
    const xPosition = startX + index * (charWidth + charSpacing);

    // Determinar o caminho para o SVG do caractere
    let charPath = '';
    if (/[A-Z]/.test(char)) {
      charPath = `/assets/plates/letters/${char}.svg`;
    } else if (/[0-9]/.test(char)) {
      charPath = `/assets/plates/numbers/${char}.svg`;
    } else {
      console.warn(`Caractere inválido na placa: ${char}`);
      return;
    }

    // Adicionar o caractere ao SVG
    svgContent += `<image class="letters" href="${charPath}" x="${xPosition}" y="${startY}" width="${charWidth}" height="${charHeight}" />`;
  });

  // Fechar o SVG
  svgContent += `</svg>`;

  // Retornar o SVG completo como uma string
  return svgContent;
};

// Function to load Controle
const loadControle = () => {
  const mainContent = document.getElementById('main-content');
  document.getElementById('page-title').innerText = 'Controle';

  // Limpar o conteúdo anterior
  mainContent.innerHTML = '';

  // Obter o número de canais/câmeras em uso
  fetch('/active-channels')
    .then(response => response.json())
    .then(channels => {
      // Criar o letreiro de status
      const statusMarquee = document.createElement('div');
      statusMarquee.id = 'status-marquee';
      statusMarquee.className = 'status-marquee';
      statusMarquee.textContent = 'Processo em execução...'; // Texto inicial

      mainContent.appendChild(statusMarquee);

      // Criar contêiner para as tabelas
      const tablesContainer = document.createElement('div');
      tablesContainer.className = 'tables-container';

      // Dividir a tela de acordo com o número de canais
      channels.forEach(channel => {
        // Criar uma tabela para cada canal
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';

        const tableTitle = document.createElement('h3');
        tableTitle.textContent = `Canal ${channel.number} - ${channel.cameraName || 'Câmera'}`;
        tableWrapper.appendChild(tableTitle);

        const table = document.createElement('table');
        table.className = 'controle-table';
        table.innerHTML = `
          <thead>
            <tr>
              <th>Nome</th>
              <th>Grupo</th>
              <th>Unidade</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Cor</th>
              <th>Placa</th>
              <th>Data/Hora</th>
            </tr>
          </thead>
          <tbody id="table-body-${channel.number}">
            <!-- Linhas serão adicionadas dinamicamente -->
          </tbody>
        `;
        tableWrapper.appendChild(table);
        tablesContainer.appendChild(tableWrapper);

        // Buscar os últimos 20 eventos para este canal
        fetch(`/events/${channel.number}`)
          .then(response => response.json())
          .then(events => {
            events.forEach(event => {
              updateControleTable(event);
            });
          })
          .catch(error => {
            console.error(`Erro ao carregar eventos para o canal ${channel.number}:`, error);
          });
      });

      mainContent.appendChild(tablesContainer);

      // Configurar os listeners Socket.IO para a página Controle
      setupControleSocket();

    })
    .catch(error => {
      console.error('Erro ao carregar os canais ativos:', error);
      mainContent.innerHTML = '<p>Erro ao carregar a página de controle.</p>';
    });
};

const updateControleTable = (data) => {
  const { channelNumber, customerInfo, timestamp } = data;
  const tbody = document.getElementById(`table-body-${channelNumber}`);

  if (!tbody) {
    console.error(`Tabela para o canal ${channelNumber} não encontrada.`);
    return;
  }

  // Criar nova linha para o acesso atual
  const newRow = document.createElement('tr');
  newRow.classList.add('current-access'); // Classe para estilização

  // Gerar o SVG da placa
  const plateSVG = generatePlateSVG(customerInfo.plate);

  // Criar uma célula com o SVG da placa
  const plateCellContent = `
    <div class="plate-svg-container">
      ${plateSVG}
    </div>
  `;

  newRow.innerHTML = `
    <td>${customerInfo.name || 'Desconhecido'}</td>
    <td>${customerInfo.group || ''}</td>
    <td>${customerInfo.unit || ''}</td>
    <td>${customerInfo.make || ''}</td>
    <td>${customerInfo.model || ''}</td>
    <td>${customerInfo.color || ''}</td>
    <td>${plateCellContent}</td>
    <td>${timestamp}</td>
  `;

  // Remover a classe 'current-access' da linha anterior, se existir
  const previousCurrent = tbody.querySelector('.current-access');
  if (previousCurrent) {
    previousCurrent.classList.remove('current-access');
    previousCurrent.style.color = ''; // Resetar a cor
    previousCurrent.style.fontWeight = ''; // Resetar o peso da fonte
  }

  // Inserir a nova linha no início do tbody
  tbody.insertBefore(newRow, tbody.firstChild);

  // Aplicar estilos à nova linha
  newRow.style.color = 'green';
  newRow.style.fontWeight = 'bold';

  // Remover linhas excedentes se houver mais de 20
  const rows = tbody.querySelectorAll('tr');
  if (rows.length > 20) {
    tbody.removeChild(tbody.lastChild);
  }
};

// Função para lidar com o evento 'process-started'
socket.on('process-started', ({ ip }) => {
  console.log(`Processo iniciado com sucesso para IP: ${ip}`);
  
  const button = findButtonByIP(ip);
  if (button) {
    button.setAttribute('data-status', 'running');
    button.setAttribute('title', 'Stop');
    button.innerHTML = '<i data-feather="square"></i>';
    feather.replace();
    button.disabled = false;
    showSnackMessage(`Reconhecimento iniciado para a câmera ${ip}.`, 'info');
    
    // Atualizar o círculo de status para verde
    updateStatusCircle(ip, 'running');
  }
});

// Função para lidar com o evento 'process-error'
socket.on('process-error', ({ ip, errorType }) => {
  console.error(`Process error for IP: ${ip}`, errorType);
  const button = findButtonByIP(ip);
  if (button) {
    button.setAttribute('data-status', 'stopped'); // Mantém o status como 'stopped' (não em execução)
    button.setAttribute('title', 'Play');
    button.innerHTML = '<i data-feather="play"></i>';
    feather.replace();
    button.disabled = false;

    // Mapear o errorType para mensagens específicas
    let message = 'Erro ao iniciar o reconhecimento.';
    if (errorType === 'connection_timeout') {
      message += ' Connection Timeout!';
    } else if (errorType === 'credentials_unauthorized') {
      message += ' Credenciais não autorizadas!';
    }

    showSnackMessage(message, 'error');
    
    // Atualizar o círculo de status para vermelho
    updateStatusCircle(ip, 'stopped');
  }
});

// Função para lidar com o evento 'process-stopped'
socket.on('process-stopped', ({ ip }) => {
  console.log(`Process stopped for IP: ${ip}`);
  const button = findButtonByIP(ip);
  if (button) {
    button.setAttribute('data-status', 'stopped');
    button.setAttribute('title', 'Play');
    button.innerHTML = '<i data-feather="play"></i>';
    feather.replace();
    button.disabled = false;
    showSnackMessage(`Reconhecimento parado para a câmera ${ip}.`, 'info');
    
    // Atualizar o círculo de status para vermelho
    updateStatusCircle(ip, 'stopped');
  }
});

socket.on('plate-found', ({ ip, data }) => {
  console.log('Placa detectada: ', ip, data);
});

socket.on('plate-not-found', ({ ip, plate }) => {
  console.log('Placa detectada:', ip, plate);
});

// Helper function to find the button by IP address
const findButtonByIP = (ip) => {
  const rows = document.querySelectorAll('#main-content table tbody tr');
  for (const row of rows) {
    const ipCell = row.cells[2]; 
    if (ipCell && ipCell.textContent.trim() === ip) {
      return row.querySelector('.play-button');
    }
  }
  return null;
};

// Event listeners for menu links
document.getElementById('cadastros-link').addEventListener('click', (e) => {
  e.preventDefault();
  loadCadastros();
});

document.getElementById('configuracoes-link').addEventListener('click', (e) => {
  e.preventDefault();
  loadConfiguracoes();
});

document.getElementById('controle-link').addEventListener('click', (e) => {
  e.preventDefault();
  loadControle();
});

document.getElementById('clear-filters').addEventListener('click', () => {
  document.getElementById('filter-nome').value = '';
  document.getElementById('filter-grupo').value = '';
  document.getElementById('filter-unidade').value = '';
  renderCadastrosTableRows(cadastrosData);
});

// Load Cadastros by default on page load
window.onload = loadCadastros;