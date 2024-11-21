# deploy wtf_wikipedia as a webserver


## ex
curl -X POST http://192.168.1.229:13090/api/wikitext \
     -H "Content-Type: application/json" \
     -d '{"wikitext": "[[Greater_Boston|Boston]]s [[Fenway_Park|baseball field]] has a {{convert|37|ft}} wall. <ref>Field of our Fathers: By Richard Johnson</ref>"}'

## server
