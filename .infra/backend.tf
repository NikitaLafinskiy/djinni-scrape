terraform {
  # Bucket is provisioned by bootstrap/.
  backend "s3" {
    bucket       = "djinni-scrape-statetf"
    key          = "djinni-scrape/terraform.tfstate"
    region       = "eu-central-1"
    use_lockfile = true
  }
}
