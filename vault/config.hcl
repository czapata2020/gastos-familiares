storage "file" {
  path = "/openbao/data/storage"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = "true"
}

ui       = true
api_addr = "http://0.0.0.0:8200"
