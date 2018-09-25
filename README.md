# SimpleXMLDB
A simple XML DB to read and write XML files. Can be configured to backup data onto AWS S3.

### TO DO
- [ ]  basic routing system - to handle the GETs, PUTs, POSTs
- [ ]  reject requests other than from whitelisted IPs
- [x]  add XML
- [ ]  modify XML
- [x]  retrieve XML by path - db
- [ ]  query XML
- [x]  if file not available on local drive, look for file in AWS S3 backup path, download if found and save it to local drive
- [ ]  queue update requests so that the updates happen one by one without overwriting others changes unintentionally
- [ ]  store recently processed files in memory for quicker updates
- [ ]  persist data on every update to local drive and AWS S3
- [ ]  remove the file in memory after a pre-configured time interval. Time interval to be reset on every access
- [ ]  able to monitor cpu/memory/disk usage of the application
- [ ]  ability to apply XSL transformations
- [ ]  add test cases for each of the functionality
