const { Empresas, Usuarios, LogAcciones, ConfiguracionAlarmas, Regiones, RegionesDispositivos } = require('./sequelize');
var Sequelize = require('sequelize');
const Op = Sequelize.Op;
const axios = require('axios');
const log = require('log-to-file');

var FCM = require('fcm-node');
var serverKey = 'AAAAs579TVE:APA91bGpdOsAr5_O0pg6D89eQU8Uj1iIxPIURmDVc4U_35aLzrZVy1hnH8C3W3Ox9jmwPslloqx5EyK6C_ApfIyok5b0RCn5jN45jkm-CFnHxnwxEBrENy3PXCPeoU3Wo2x6QtvySYfQ';
var fcm = new FCM(serverKey);
var soap = require('soap');
var variables = require('./variables');

module.exports = {
    analizaAlarma: function (wp, disp) {
        //console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
        //console.log('Pasó por analizaAlarma')
        //console.log('Codigo: ' + wp.Codigo + ' iddisp: ' + wp.IdDispositivo)
        ConfiguracionAlarmas.findOne({
            where: {
                [Op.and]: [
                    { IdDispositivo: wp.IdDispositivo },
                    { Codigo: wp.Codigo }
                ]
            }
        })
            .then(ca => {
                if (ca === null)
                    return;

                let newLogAccion = {
                    IdWaypoint: wp.Id,
                    IdUsuario: disp.IdUsuario,
                    Codigo: wp.Codigo,
                    Evento: ca.NombreParticular,
                    Dispositivo: disp.Descripcion,
                    direccion: wp.Latitud + ', ' + wp.Longitud,
                    FechaHora: wp.FechaHora,
                    IdDispositivo: wp.IdDispositivo,
                    Velocidad: wp.Velocidad,
                    Millage: wp.Millage,
                    Latitud: wp.Latitud,
                    Longitud: wp.Longitud,
                    Millage: wp.Millage
                }
                LogAcciones.create(newLogAccion)
                    .then(la => {
                        // console.log('LogAccion almacenada')
                    })

                //Si Email es true, se envía push
                if (ca.Email === true) {
                    let usuarios = disp.up1;
                    usuarios.forEach(us => {
                        if (((us.Token != "") && (us.Token != null))) {
                            let fh = new Date(wp.FechaHora).getTime()
                            let now = new Date().getTime()
                            let dif = now - fh
                            let DiezMin = 10 * 60 * 1000;
                            if (dif < DiezMin)
                                enviaPush(wp, disp, ca, us.Token)
                        }
                    });
                }
            })
    },

    waypointForSocket: function (wp){
        axios.post('http://45.236.129.69:2040/newwaypointForSocket', {wp})
            .then(function (response) {
                //console.log(response);
            })
            .catch(function (error) {
                console.log('Error en Axios:', error);
            });
    },

    calculaCheckSum: function (cadena) {
        let total;
        let entero;
        let enDec = 0;
        let arr = cadena.match(/.{1,1}/g);
        for (i = 0; i < arr.length; i++) {
            enDec += arr[i].charCodeAt(0);
        }
        total = (enDec / 256);
        entero = Math.floor(total);
        total = total - entero;
        return (total * 256).toString(16).toUpperCase()
    },

    padLeft: function (nr, n, str) {
        return Array(n - String(nr).length + 1).join(str || '0') + nr;
    },

    verificaGeocerco: function (wp, disp) {
        //console.log('Pasó por verificaGeocerco')
        //console.log('disp.IdEmpresa: ' + disp.IdEmpresa)
        Regiones.findAll({
            include: [
                {
                    model: RegionesDispositivos,
                    as: 'RegionesDispositivos',
                    attributes: ['Id', 'IndCheckIn', 'IndCheckOut', 'EstadoCheckIn', 'NotificaExcesoIn'],
                    where: { IdDispositivo: disp.Id }
                },
                {
                    model: Empresas,
                    as: 'Empresas',
                    attributes: ['Id'],
                    include: [{
                        model: Usuarios,
                        as: 'Usuarios',
                        attributes: ['Id', 'Token']
                    }]
                }
            ],
            where: { IdEmpresa: disp.IdEmpresa },
            attributes: ['Id', 'Descripcion', 'Latitud', 'Longitud', 'Radio']
        })
            .then(regiones => {

                regiones.forEach(reg => {
                    // Si no existen regiones asociadas al dispositivo, termina el método
                    if (reg.RegionesDispositivos === null) {
                        console.log(' no existen regiones asociadas al dispositivo')
                        return;
                    }

                    let procesar = false;
                    let accion = false;
                    let etiqueta = '';

                    let dist = distance(reg.Latitud, reg.Longitud, wp.Latitud, wp.Longitud, 'K')

                    if (dist < reg.Radio && reg.RegionesDispositivos.IndCheckIn === true && reg.RegionesDispositivos.EstadoCheckIn === false) {
                        procesar = true;
                        accion = 'Ingresa';
                        etiqueta = "Entró a " + reg.Descripcion
                        //console.log(etiqueta)
                    }

                    if (dist > reg.Radio && reg.RegionesDispositivos.IndCheckOut === true && reg.RegionesDispositivos.EstadoCheckIn === true) {
                        procesar = true;
                        accion = 'Sale';
                        etiqueta = "Salió de " + reg.Descripcion
                        //console.log(etiqueta)
                    }

                    //El móvil está dentro del GeoCerco, está marcado su revisión y no entró recién
                    if (dist < reg.Radio && reg.RegionesDispositivos.IndCheckIn === true && reg.RegionesDispositivos.EstadoCheckIn === true && (wp.Velocidad > reg.VelMax)) {
                        procesar = false;
                        accion = 'VerificaVelocidad'
                        etiqueta = "Exceso de velocidad dentro de geocerco " + reg.Descripcion
                        if (wp.Velocidad > reg.VelMax) {
                            let newLogAccion = {
                                IdWaypoint: wp.Id,
                                IdUsuario: disp.IdUsuario,
                                Codigo: 120,
                                Evento: etiqueta,
                                Dispositivo: disp.Descripcion,
                                direccion: wp.Latitud + ', ' + wp.Longitud,
                                FechaHora: wp.FechaHora,
                                IdDispositivo: wp.IdDispositivo,
                                Velocidad: wp.Velocidad,
                                Velocidad: wp.Millage,
                                Latitud: wp.Latitud,
                                Longitud: wp.Longitud,
                                Millage: wp.Millage
                            }
                            LogAcciones.create(newLogAccion)
                                .then(la => {
                                    console.log('LogAccion almacenada')
                                })
                        }
                    }

                    if (procesar === true) {
                        let newLogAccion = {
                            IdWaypoint: wp.Id,
                            IdUsuario: disp.IdUsuario,
                            Codigo: 150,
                            Evento: etiqueta,
                            Dispositivo: disp.Descripcion,
                            direccion: wp.Latitud + ', ' + wp.Longitud,
                            FechaHora: wp.FechaHora,
                            IdDispositivo: wp.IdDispositivo,
                            Velocidad: wp.Velocidad,
                            Latitud: wp.Latitud,
                            Longitud: wp.Longitud,
                            Millage: wp.Millage
                        }
                        LogAcciones.create(newLogAccion)
                            .then(la => {
                                console.log('LogAccion almacenada: ' + reg.Id)
                                console.log('')
                                console.log('reg.RegionesDispositivos.Id: ' + reg.RegionesDispositivos.Id)
                                console.log('')
                                console.log('accion: ' + accion)
                                if (accion === 'Ingresa')
                                    RegionesDispositivos.update({ EstadoCheckIn: true, UltimoFranqueoIn: wp.FechaHora },
                                        { where: { Id: reg.RegionesDispositivos.Id } })
                                        .then(console.log('RegionesDispositivos actualizado. EstadoCheckIn: false'))
                                else
                                    RegionesDispositivos.update({ EstadoCheckIn: false, UltimoFranqueoOut: wp.FechaHora },
                                        { where: { Id: reg.RegionesDispositivos.Id } })
                                        .then(console.log('RegionesDispositivos actualizado. EstadoCheckIn: true'))

                                // Envía push
                                let ca = {
                                    NombreParticular: etiqueta
                                }
                                // disp.up1.forEach(ele => {
                                //     console.log(ele.dataValues)
                                // });
                                let usuarios = disp.up1
                                usuarios.forEach(usu => {
                                    if (usu.Token != null) {
                                        let fh = new Date(wp.FechaHora).getTime()
                                        let now = new Date().getTime()
                                        let dif = now - fh
                                        let DiezMin = 10 * 60 * 1000;
                                        if (dif < DiezMin)
                                            enviaPush(wp, disp, ca, usu.Token)
                                    }
                                });

                            })
                    }
                });
            })
    },

    enviaUnigis(wp, disp) {
        let SystemUser = 'tecnosinergia'
        let Password = 'tecnosinergia2020$'
        let ignicion = 0;
        if (wp.Digitales === '0400' || wp.Digitales === '0800')
            ignicion = 1
        var url = 'http://unigis1.unisolutions.com.ar/presta/unigis/MAPI/SOAP/gps/Service.asmx?wsdl';

        let fechaRxPlusOneMinute = new Date(wp.FechaHora).getTime()
        fechaRxPlusOneMinute += 1 * 60 * 1000
        var args = {
            SystemUser: SystemUser,
            Password: Password,
            Dominio: disp.Patente,
            NroSerie: '-1',
            Codigo: '1',
            Latitud: wp.Latitud.toString(),
            Longitud: wp.Longitud.toString(),
            Altitud: '0',
            Velocidad: Math.round(+wp.Velocidad).toString(),
            FechaHoraEvento: new Date(wp.FechaHora).toISOString(),
            FechaHoraRecepcion: new Date(fechaRxPlusOneMinute).toISOString()
        };

        soap.createClient(url, function (err, client) {
            client.LoginYInsertarEvento(args, function (err, result) {
                if (err) {
                    console.log('-----------------------------------')
                    console.log('XXXX ERROR EN Unigis XXX')
                    console.log('Patente: ' + disp.Patente)
                    console.log('------------------------------------')
                    console.log(args)
                    console.log(err)
                }
                else {
                    // console.log('-----------------------------------')
                    // console.log('Unigis enviado: ' + disp.Patente);
                    // console.log('-----------------------------------')
                }
            });
        });
    },

    enviaQanalytics(wp, disp) {
        let ignicion = 0;
        if (wp.Digitales === '0400' || wp.Digitales === '0800')
            ignicion = 1
        var url = 'http://ww2.qanalytics.cl/gps_tecnosinergia/service.asmx?wsdl';

        var args = {
            ID_REG: wp.Id,
            LATITUD: +wp.Latitud,
            LONGITUD: +wp.Longitud,
            VELOCIDAD: Math.round(+wp.Velocidad),
            SENTIDO: Math.round(wp.Heading),
            FH_DATO: new Date(wp.FechaHora).toISOString(),
            PLACA: disp.Patente,
            CANT_SATELITES: +wp.Satelites,
            HDOP: 1,
            TEMP1: 0,
            TEMP2: 0,
            TEMP3: 0,
            SENSORA_1: 0,
            AP: 0,
            IGNICION: ignicion,
            PANICO: 0,
            SENSORD_1: 0,
            TRANS: disp.QAnalyticsName,
        };

        soap.createClient(url, function (err, client) {
            var Authentication = '<Authentication xmlns="http://tempuri.org/"><Usuario>WS_tecnosinergia</Usuario><Clave>$$WS16</Clave></Authentication>'
            client.addSoapHeader(Authentication);

            client.WM_INS_REPORTE_PUNTO_A_PUNTO(args, function (err, result) {
                if (err) {
                    console.log('-----------------------------------')
                    console.log('XXXX ERROR EN QANALYTICS XXX')
                    console.log('Patente: ' + disp.Patente)
                    //console.log(err.body)
                    console.log('------------------------------------')
                    console.log(args)
                }
                else {
                   // console.log('QAnalytics enviado: ' + disp.Patente);
                }
            });
        });
    },

    enviaSkynav(wp, disp) {
        let evento = "NORMAL"
        switch (wp.Codigo) {
            case 3:
                evento = "MOTOR_ON"
                break;
            case 11:
                evento = "MOTOR_OFF"
                break;
            case 19:
                evento = "EXCESO_VEL"
                break;
            case 23:
                evento = "EXT_PWR_OFF"
                break;
        }
        let content = {
            transmisiones: [{
                empresa: 'tecnosinergia',
                imei: disp.Imei,
                placa: disp.Patente,
                tiempoEvento: new Date(wp.FechaHora).toISOString(),
                tiempoEnvio: new Date(wp.FechaHora).toISOString(),
                evento: evento,
                latitud: wp.Latitud,
                longitud: wp.Longitud,
                velocidad: wp.Velocidad,
                heading: wp.Heading,
                altitud: wp.Altitud,
                odometro: 5500
            }]
        }

        const config = {
            headers: {
                'Content-Type': 'application/json',
                empresa: 'tecnosinergia',
                //token: '18EA285983DF355F3024E412FB46AD6CBD98A7FFE6872E26612E35F38AA39C41' // para empresa='test'
                token: '45E97D251F864346A4D69B9189DCE625EB5AB03C94D22449F4F32CC779999F2B'
            }
        };
        const url = 'http://contratistas.skynav.cl:8081/transmision/tecnosinergia';
        axios.put(url, JSON.stringify(content), config).then(response => {
            // console.log(response.data)
        })
            .catch(err => {
                console.log('ERROR EN SKYNAV')
                console.log('')
            })
    },

    enviaMigtra(wp, disp) {
        let ignicion = 0
        if (wp.Digitales === '0400')
            ignicion = 1
        let content = [{
            "id": wp.Id,
            "asset": disp.Patente,
            "dtgps": new Date(wp.FechaHora).toISOString(),
            "dtrx": new Date(wp.FechaHora).toISOString(),
            "lat": wp.Latitud,
            "lon": wp.Longitud,
            "alt": Math.round(wp.Altitud),
            "spd": Math.round(wp.Velocidad),
            "angle": Math.round(wp.Heading),
            "dop": 1.1,
            "fix": 1,
            "ign": ignicion
        }]

        let username = 'tecnosinergia'
        let password = 'Ht78Hj7ezckgRZYv'
        const usernamePasswordBuffer = Buffer.from(username + ':' + password);
        const base64data = usernamePasswordBuffer.toString('base64');

        const url = 'https://ws.migtra.com/rawdata/codelcodsal';
        // const url = 'https://ws.migtra.com/rawtest/codelcodsal'; //Para hacer pruebas

        axios.post(url, content, { headers: { 'Authorization': 'Basic ' + base64data } })
            .then(function (response) {
                //console.log('Envío a Migra Ok ' + disp.Patente);
            }).catch(function (error) {
                console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> Error enviando a Migtra')
            });
    }

}

function distance(lat1, lon1, lat2, lon2, unit) {
    if ((lat1 == lat2) && (lon1 == lon2)) {
        return 0;
    }
    else {
        var radlat1 = Math.PI * lat1 / 180;
        var radlat2 = Math.PI * lat2 / 180;
        var theta = lon1 - lon2;
        var radtheta = Math.PI * theta / 180;
        var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) {
            dist = 1;
        }
        dist = Math.acos(dist);
        dist = dist * 180 / Math.PI;
        dist = dist * 60 * 1.1515;
        if (unit == "K") { dist = dist * 1.609344 }
        if (unit == "N") { dist = dist * 0.8684 }
        return dist;
    }
}

function enviaPush(wp, disp, confAlar, token) {
    let utcOffset = variables.UTC
    let fechaEvento = new Date(wp.FechaHora).getTime() // + (utcOffset * 60 * 60 * 1000)
    // console.log('---------------------------------------------------> Pasó por enviaPush')
    // console.log(wp.FechaHora)
    // console.log('utcOffset: ' + (utcOffset))
    // console.log(new Date(fechaEvento))
    // console.log(disp.Id)
    // console.log('---------------------------------------------------> ')
    var message = {
        to: token,
        notification: {
            title: disp.Descripcion,
            body: confAlar.NombreParticular + '  ' + new Date(fechaEvento).toLocaleTimeString(), //wp.FechaHora.toLocaleTimeString(),
            sound: "default",
            icon: "ic_launcher" //default notification icon
        },
        // data: data //payload you want to send with your notification
    };
    fcm.send(message, function (err, response) {
        if (err) {
            console.log("Notifición no enviada: " + err);
        } else {
            console.log("Notificación enviada!"); //, response);
        }
    });
}

// let w = { FechaHora: '2020-07-07T16:10:07.000Z' }
// let d = { Descripcion: 'Prueba' }
// let c = { NombreParticular: 'Evento de prueba' }
// let t = 'cb0Im9kFIiA:APA91bGgy4CYGJRePf0ttaVfbIWKS9luruhjX2qOFtRL1M5yftZlY65KDujvYKYxkEoaPgEvXr-6T7ZHXJV4Z4LJ9TGib5a1Jv70TwldFHXRxPgX57vKIVI0MRMY1gxljnnCMpOLR5Ws'

// enviaPush(w, d, c, t)