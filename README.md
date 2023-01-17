# FUNCION DE LA APLICACIÓN

Este sistema es un Listener que atiende las conexiones de los medidores LOVATO
Una vez que tiene una conexión entrante, comienza a enviar los comandos que 
están en comandosLovato.json y espera por sus respuestas.


# CONFIGURACIÓN DE variables.json

"TiempoMuestreo" (en milisegundos):
Es el tiempo de espera entre cada grupo de envíos que se hace 
al medidor