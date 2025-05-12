docker-network:
	docker network create elastic

docker-pull:
	docker pull docker.elastic.co/elasticsearch/elasticsearch:8.17.6

docker-run:
	docker run --name es01 --net elastic -p 9200:9200 -it -m 1GB docker.elastic.co/elasticsearch/elasticsearch:8.17.6

docker-cp-cert:
	docker cp es01:/usr/share/elasticsearch/config/certs/http_ca.crt .

docker-ping:
	curl --cacert http_ca.crt -u elastic:$(ELASTIC_PASSWORD) https://localhost:9200

docker-clean-network:
	docker network rm elastic

docker-clean-container:
	docker rm es01
