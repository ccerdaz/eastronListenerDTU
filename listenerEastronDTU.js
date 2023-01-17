var net = require('net');
const app = require('express')();
let clientesArray = [];
const crc = require('node-crc16');

var HOST = '0.0.0.0'; //'127.0.0.1';
var PORT = 4150

const server = require('http').createServer(app);
var modbus = require("jsmodbus");

let comandoConsultado = 0
let salida = {}

let comandos = require('./comandosEastron.json')
let variables = require('./variables.json')

const axios = require('axios')

/**
 * Cantidad de dispositivos que se conectarán
 * Si la cantidad es 3, entonces los ID de cada
 * dispositivo serán 1, 2 y 3
 */
const cantDispositivos = 1

/**
 * Inicia la comunicación para recibir comunicaciones entrantes
 * desde los DTU
 */
net.createServer(async function (sock) {
    console.log('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort);

    console.log('Pasó por CONNECTED');

    let ip = sock.remoteAddress
    let puerto = +sock.remotePort

    almacenaCliente(ip, puerto)

    // Inicia el envío de comandos al DTU/Medidor
    enviaRequest(sock)

    // Data entrante
    sock.on('data', async function (data) {
        console.log('Data entrante:', data);

        analizaData(data)
    });

    sock.on('error', function (err) {
        console.log('Error: ' + err)
    })

    sock.on('connect', (stream) => {
        console.log('xxxxxxxxxxxxxxxxxxxxxxxx someone connected!');
    });

    // Add a 'close' event handler to this instance of socket
    sock.on('close', function (data) {
        console.log('')
        console.log('CLOSED: ' + sock.remoteAddress + ' ' + sock.remotePort);
        let index = clientesArray.findIndex(e => e.Ip == sock.remoteAddress && e.Puerto == sock.remotePort)
        if (index > -1) {
            clientesArray.splice(index, 1)
        }
    });

}).listen(PORT, HOST);

async function enviaRequest(sock) {

    loop1:
    for (let j = 1; j <= cantDispositivos; j++) {

        loop2:
        for (let i = 0; i < comandos.length; i++) {
            let aux = []
            const e = comandos[i];

            comandoConsultado = e.id

            console.log('Se consulta comando', e.nombre);

            let index = clientesArray.findIndex(e => e.Ip == sock.remoteAddress && e.Puerto == sock.remotePort)

            // En el primer comando se guarda el InitTime
            if (index > -1 && comandoConsultado == 1) {
                clientesArray[index].InitTime = new Date().getTime()
            }

            if (comandoConsultado == 100) {
                uploadData(sock)
                break loop2; // Termino el proceso
            }

            // Slave Address
            aux.push(j)

            // El número de la función
            aux.push(e.funcion)

            for (let d = 0; d < e.direccion.length; d++) {
                const element = e.direccion[d];
                aux.push(element)
            }

            if (e.funcion == 3) {
                for (let d = 0; d < e.numberOfPoints.length; d++) {
                    const element = e.numberOfPoints[d];
                    aux.push(element)
                }
            }
            else {
                for (let l = 0; l < e.largo.length; l++) {
                    const element = e.largo[l];
                    aux.push(element)
                }
            }

            let crc = calculaCRC(aux)

            aux.push(crc[0])
            aux.push(crc[1])

            sock.write(Buffer.from(aux))

            //Pausa entre comandos
            await sleep(variables.TiempoEntreConsultas);
        }
    }

}

async function uploadData(sock) {
    console.log('Se sube la siguiente data:', salida);

    let ruta = variables.rutaApi + 'newdatoEastron'

    let index = clientesArray.findIndex(e => e.Ip == sock.remoteAddress && e.Puerto == sock.remotePort)

    if (index > -1) {
        salida.SerialNumber = '21009719' //clientesArray[index].MacDevice
    }

    axios.post(ruta, salida)
        .then(function (response) {
            console.log('Dato almacenado en el server!');
        })
        .catch(function (error) {
            console.log('Error al enviar con Axios');
            //console.log(error);
        });


    let initTime
    let lapso = variables.TiempoMuestreo //en Milisegundos
    let now = new Date().getTime()
    let resta = 0
    if (index > -1) {
        initTime = clientesArray[index].InitTime
        resta = now - initTime
        resta = lapso - resta
        console.log('pausa es de :', resta);
        await sleep(resta)
        enviaRequest(sock)
    }


}

async function analizaData(data) {
    //console.log('data: ', data);

    //Convierte buffer en array
    let arr = [...data]

    //console.log('arr: ', arr);

    //Extrae los bytes que contienen la respuesta (5 y 6)
    let newbuffer = [arr[3], arr[4], arr[5], arr[6]]

    //Convierte la respuesta a un valor decimal
    let valor
    if (comandoConsultado == 15)
        valor = Buffer.from(newbuffer).readInt32BE() //.readFloatBE();
    else
        valor = Buffer.from(newbuffer).readFloatBE();

    let index = comandos.findIndex(e => e.id == comandoConsultado)
    if (index < 0) {
        console.error('index de comando no existe');
        return;
    }

    console.log(comandos[index].campo + ': ' + valor);
    console.log('');
    salida[comandos[index].campo] = valor
}

function almacenaCliente(ip, puerto, iddevice) {
    console.log('----------->>>   pasa por almacenaCliente');
    clientesArray.push({
        Ip: ip,
        Puerto: puerto,
        MacDevice: '',
        InitTime: new Date().getTime()
    })
}

function decodeBuffer(buf) {
    // let buf = Buffer.from([0x42, 0x48, 0x69, 0xc0]);
    payload = buf.readFloatBE();
    return payload
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function calculaCRC(_crc16) {
    // const crc16 = CRC(Buffer.from(_crc16));
    // let _aux = crc16.split(/(?=(?:..)*$)/)
    // let salida = []
    // _aux.forEach(e => {
    //     salida.push(parseInt(e, 16));
    // });
    // return salida;
    const crc16 = crc.checkSum(Buffer.from(_crc16), { retType: 'array' });
    return crc16;
}

console.log('Listener puerto ' + PORT);

/**
 * Respuesta típica sería
 * 1 4 4 43 5F FB E0 9C AA
 *
 * Donde:
 * 1: Address
 * 4: Comando enviado
 * 4: Bytes recibidos
 * 43 5F FB E0: la Data!!
 * 9C AA: el CRC
 */


/**
 * PARA RECIBIR PETICIONES HTTP
 */
const port = PORT + 1
server.listen(port, () => {
    console.log('Running on http://localhost:' + port)
});

app.get('/', function (req, res) {
    res.json(clientesArray)
});