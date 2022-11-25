export async function runJob(jobName) {
  return new Promise((resolve, reject) => {
    import(`../jobs/${jobName}.mjs`).catch(reject)
                                    .then(job => {
      job.run().then(resolve)
    })
  })
}