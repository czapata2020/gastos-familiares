FROM ghcr.io/openbao/openbao:2

COPY config.hcl /etc/openbao/config.hcl
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

VOLUME /openbao/data
EXPOSE 8200

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
